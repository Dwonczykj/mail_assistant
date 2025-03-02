import { google } from 'googleapis';
import type { gmail_v1 } from 'googleapis';
import { OAuth2Client, Credentials } from 'google-auth-library';
import { config } from '../Config/config';
import { GmailAdaptor } from '../models/GmailAdaptor';
import { IEmailClient } from './IEmailClient';
import { ILabel } from '../models/Label';
import { Email } from '../models/Email';
import { ILogger } from '../lib/logger/ILogger';
import { FyxerAction } from '../data/entity/action';
import { IFyxerActionRepository } from './IFyxerActionRepository';
import { gmailPubSubConfig } from '../Config/config';
import { Injectable, Inject } from '@nestjs/common';
// import { AuthEnvironment, GoogleAuthFactoryService } from '../lib/auth/services/google-auth-factory.service';
import { IGoogleAuthService, IGoogleAuthService2 } from '../lib/auth/interfaces/google-auth.interface';
import { Message, Subscription, PubSub } from '@google-cloud/pubsub';
import { ILockable } from '../lib/auth/interfaces/ILockable';
import { RequestContext } from '../lib/context/request-context';
import { ProcessedObjectRepository } from './ProcessedObjectRepository';
import { ObjectType } from '../data/entity/ProcessedObject';

@Injectable()
export class GmailClient extends ILockable implements IEmailClient {

    public readonly name: string = "gmail";
    private readonly emailAdaptor: GmailAdaptor = new GmailAdaptor();
    private readonly historyTypes: string[] = ['messageAdded', 'labelAdded']; // TODO: Check if this is all we want to check

    private gmailLabels: gmail_v1.Schema$Label[] = [];
    private gmailLabelsExpireAt: Date | null = null;
    private pullPubSubSubscription: Subscription | null = null;


    // private authClient: OAuth2Client | null = null; // TODO: GET/Store this on the auth service not here.
    // private credentials: Credentials | null = null; // TODO: Store this on the auth service not here.
    // public get authClient(): Promise<OAuth2Client | null> {
    //     return await this.googleAuthService.getAuthenticatedClient({user: this.serviceUser});
    // }
    // public get credentials() {
    //     return this.googleAuthService.oAuthClient.credentials;
    // }
    // public get httpGoogleClient(): gmail_v1.Gmail | null {
    //     if (!this.authClient) {
    //         return null;
    //     }
    //     return google.gmail({ version: 'v1', auth: this.authClient });
    // }

    // public get authenticated(): Promise<boolean> {
    //     // TODO: Defer to the auth provider.
    //     return Promise.resolve(this.authClient !== null);
    // }

    // public get credentials_access_token(): string | null {
    //     return this.credentials?.access_token || null;
    // }

    // public get credentials_expiry_date(): number | null {
    //     return this.credentials?.expiry_date || null;
    // }


    constructor(
        @Inject('ILogger') private readonly logger: ILogger,
        @Inject('IGoogleAuthService') private readonly googleAuthService: IGoogleAuthService2,
        @Inject('IFyxerActionRepository') private readonly fyxerActionRepo: IFyxerActionRepository,
        @Inject('ProcessedObjectRepository') private readonly processedObjectRepo: ProcessedObjectRepository,
    ) {
        super();
    }

    private async getHttpGoogleClient(): Promise<gmail_v1.Gmail> {
        const oAuthClient = await this.googleAuthService.getAuthenticatedClient();
        if (!oAuthClient) {
            this.logger.error('Gmail client not authenticated');
            throw new Error('Gmail client not authenticated. Please authenticate first.');
        }
        return google.gmail({ version: 'v1', auth: oAuthClient });
    }

    /**
     * Listens for incoming emails using Gmail API's watch functionality.
     * It sets up push notifications on the "INBOX" by using a webhook/topic that is setup in the Google Cloud Pub/Sub console and routes to our WebAPI application.
     */
    public async listenForIncomingEmails({
        processEmailCallback
    }: {
        processEmailCallback: (email: Email) => Promise<void>
    }): Promise<void> {
        const contextData = RequestContext.get();
        const user = contextData.user; // BUG It is set correctly in service but here is a different instance passed in and therefore user is null.

        // Log user info if available, otherwise note that we're in daemon mode
        const userInfo = user ? `${user.email} (${user.id})` : 'daemon mode (no user context)';
        this.logger.info(`Listening for incoming emails on topic: ${config.google.gmailTopic || gmailPubSubConfig.topicName} from user: ${userInfo}`);

        // If we don't have a user in context, try to get the service user
        if (!user) {
            this.logger.warn('No user found in RequestContext, email operations may fail');
            return;
        }

        const topicName: string = config.google.gmailTopic || gmailPubSubConfig.topicName;
        try {
            // Check if we have valid auth
            const res = await (await this.getHttpGoogleClient()).users.watch({
                userId: 'me',
                requestBody: {
                    labelIds: ['INBOX'],
                    topicName: topicName,
                },
            });
            this.logger.info(`✅👀 Watch added to Gmail: Push Gmails to Pub/Sub topic: ${topicName} with expiration date: ${res.data.expiration ? new Date(Number.parseInt(res.data.expiration)).toLocaleString() : 'unknown'}`, { "response": res.data });
            await this.pullMessagesFromPubSubLoop({ processor: processEmailCallback });
        } catch (error: any) {
            this.logger.error(`❌👀 Failed to set up email watch for topic: ${topicName} with error: ${error}`, { "error": error.toString() });
            throw error;
        }
    }

    public async killIncomingEmailListener(): Promise<void> {
        try {
            await (await this.getHttpGoogleClient()).users.stop({
                userId: 'me',
            });
            this.logger.info('✅🧹 Incoming email listener killed');
        } catch (error: any) {
            this.logger.error(`❌🧹 Failed to kill incoming email listener with error: ${error}`, { "error": error.toString() });
            throw error;
        }
        try {
            await this.pullPubSubSubscription?.close();
            this.logger.info('✅🧹 Pull Pub/Sub subscription closed');
        } catch (error: any) {
            this.logger.error(`❌🧹 Failed to close pull Pub/Sub subscription with error: ${error}`, { "error": error.toString() });
            throw error;
        }
    }

    /**
     * Pulls messages from Pub/Sub and processes them.
     * This method creates a Pub/Sub subscription, sets up a message handler, and listens for incoming messages.
     * It logs each received message and acknowledges it after processing.
     * 
     * @returns {Promise<void>} A promise that resolves when the subscription is successfully set up.
    **/
    async pullMessagesFromPubSubLoop({
        processor
    }: {
        processor: (email: Email) => Promise<void>
    }): Promise<void> {
        const pubsub = new PubSub();
        const topicName = config.google.pubSubConfig.topicName;
        const subscriptionName = config.google.pubSubConfig.subscriptionNamePull;

        try {
            this.logger.info(`Setting up PubSub subscription: ${subscriptionName} for topic: ${topicName}`);

            // Get the subscription
            this.pullPubSubSubscription = pubsub.subscription(subscriptionName);

            // Check if the subscription exists
            const [exists] = await this.pullPubSubSubscription.exists();
            if (!exists) {
                this.logger.warn(`Subscription ${subscriptionName} does not exist. Creating it now.`);
                // Create the subscription if it doesn't exist
                [this.pullPubSubSubscription] = await pubsub.createSubscription(topicName, subscriptionName);
            }

            // Verify subscription type
            const [metadata] = await this.pullPubSubSubscription.getMetadata();
            if (metadata.pushConfig && metadata.pushConfig.pushEndpoint) {
                this.logger.warn(`Subscription ${subscriptionName} is configured as a push subscription. Pull methods may not work.`);
                return;
            }

            const messageHandler = async (message: Message) => {
                try {
                    this.logger.info(`Received message[${message.id}]: ${message.data} \nwith attributes: ${JSON.stringify(message.attributes)}`);

                    // we need to add the email to a queue on the event bus to be processed if we want to use a pull sub from the 
                    await this.processGmailNotification({ message, processor });

                    // Acknowledge the message after processing it
                    message.ack();
                } catch (error) {
                    this.logger.error(`Error processing message: ${error}`, { error });
                    // You might want to nack the message in case of processing errors
                    // message.nack();
                    message.ack(); // Or still ack it to prevent redelivery
                }
            };

            this.pullPubSubSubscription.on('message', messageHandler);

            // Handle errors
            this.pullPubSubSubscription.on('error', error => {
                this.logger.error('Error receiving message from PubSub:', {
                    error: error.toString(),
                    code: error.code,
                    details: error.details,
                    name: error.name,
                    stack: error.stack
                });

                // If this is a subscription type error, we might need to reconfigure
                if (error.code === 9 && error.details?.includes('not supported for this subscription type')) {
                    this.logger.warn('This appears to be a push subscription. Consider reconfiguring it as a pull subscription or using a different approach.');
                }
            });

            this.logger.info(`Successfully set up PubSub subscription: ${subscriptionName}`);
        } catch (error) {
            if (error instanceof Error) {
                this.logger.error('Failed to set up PubSub subscription:', {
                    error: error.toString(),
                    stack: error.stack,
                    subscriptionName
                });
            } else {
                this.logger.error('Failed to set up PubSub subscription:', {
                    error: `${error}`,
                    stack: undefined,
                    subscriptionName
                });
                throw error;
            }
        }
    }

    /**
     * Processes Gmail notifications received from PubSub.
     * This method is called when a new message is received from the PubSub subscription.
     * It parses the message data and fetches new emails using the historyId provided in the notification.
     * 
     * @param message - The PubSub message containing Gmail notification data
     * @returns {Promise<void>} A promise that resolves when the notification is processed
     */
    private async processGmailNotification({ message, processor }: { message: Message, processor: (email: Email) => Promise<void> }): Promise<void> {
        try {
            const data = JSON.parse(message.data.toString());
            this.logger.info('Processing Gmail notification:', { data });

            // Check if this is a Gmail notification with historyId
            if (data.emailAddress && data.historyId) {
                const emailAddress = data.emailAddress;
                const historyId = data.historyId;

                this.logger.info(`Received notification for ${emailAddress} with historyId: ${historyId}`);

                // Fetch history to get changes since the last historyId
                const historyResponse = await (await this.getHttpGoogleClient()).users.history.list({
                    userId: 'me',
                    startHistoryId: historyId,
                    historyTypes: this.historyTypes // TODO: Check if this is all we want to check
                });

                const history = historyResponse.data.history || [];
                this.logger.info(`Found ${history.length} history records since historyId ${historyId}`);
                if (history.length === 0) {
                    this.logger.warn(`Received notification for ${data.emailAddress} with historyId: ${data.historyId} but no history records found`);
                }

                // Process each history record
                for (const record of history) {
                    // Process messages that were added
                    if (record.messagesAdded) {
                        for (const messageAdded of record.messagesAdded) {
                            if (messageAdded.message && messageAdded.message.id) {
                                // Fetch the full message details
                                const msgDetail = await (await this.getHttpGoogleClient()).users.messages.get({
                                    userId: 'me',
                                    id: messageAdded.message.id
                                });

                                // Convert to our Email model
                                const email = this.emailAdaptor.adapt(msgDetail.data);
                                this.logger.info(`New email received: ${email.subject}`);

                                await this.appendHistoryIdToProcessedObjectHistoryIfNew({ historyId, email });
                            }
                        }
                    }

                    // You can also process other history types like labelAdded if needed
                }


                // Store the latest historyId for future reference
                // You might want to persist this in a database
                // this.lastHistoryId = historyId;
            }
        } catch (error) {
            this.logger.error(`Error processing Gmail notification for message: ${JSON.stringify(message)}`, { error, message });
            throw error;
        }
    }

    public async fetchLastEmails({
        count,
        lastNHours = 24
    }: {
        count: number,
        lastNHours?: number
    }): Promise<Email[]> {
        try {
            const query = `after:${lastNHours ? Math.floor(new Date(Date.now() - lastNHours * 60 * 60 * 1000).getTime() / 1000) : ''}`;
            this.logger.info(`Fetching last ${count} emails with query: "q=${query}"`);
            const listResponse = await (await this.getHttpGoogleClient()).users.messages.list({
                userId: 'me',
                maxResults: count,
                q: query
            });

            const messagesList = listResponse.data.messages || [];

            const messagePromises = messagesList.map(async (msg) => {
                const msgDetail = await (await this.getHttpGoogleClient()).users.messages.get({
                    userId: 'me',
                    id: msg.id || '',
                });
                return msgDetail.data;
            });

            const messages = await Promise.all(messagePromises);
            return messages
                .filter((msg): msg is gmail_v1.Schema$Message => !!msg)
                .map(this.emailAdaptor.adapt);
        } catch (error) {
            this.logger.error('Failed to fetch emails:', { "error": error });
            throw error;
        }
    }

    private async listGmailLabels({
        forceRefresh = false
    }: {
        forceRefresh?: boolean
    } = {}): Promise<gmail_v1.Schema$Label[]> {
        if (!this.isGmailLabelsExpired() && !forceRefresh) {
            return this.gmailLabels;
        }

        const labelResponse = await (await this.getHttpGoogleClient()).users.labels.list({
            userId: 'me'
        });
        this.gmailLabels = labelResponse.data.labels || [];
        this.gmailLabelsExpireAt = new Date(Date.now() + 1000 * 60 * 5); // 5 minutes
        return this.gmailLabels;
    }

    private isGmailLabelsExpired(): boolean {
        return this.gmailLabelsExpireAt ? this.gmailLabelsExpireAt < new Date() : true;
    }

    private async getOrCreateGmailLabel(label: ILabel): Promise<gmail_v1.Schema$Label> {
        return this.withLock(async () => {
            try {
                // Force refresh labels to ensure we have the latest
                const gmailLabels = await this.listGmailLabels();
                let gmailLabel = gmailLabels.find(l => l.name === label.name);

                if (!gmailLabel) {
                    try {
                        const createResponse = await (await this.getHttpGoogleClient()).users.labels.create({
                            userId: 'me',
                            requestBody: {
                                name: label.name,
                                labelListVisibility: 'labelShow',
                                messageListVisibility: 'show'
                            }
                        });
                        const newLabel = createResponse.data;
                        this.logger.info('Created Gmail label:', { "label": newLabel });
                        this.gmailLabels.push(newLabel);
                        return newLabel;
                    } catch (error: any) {
                        // If we get a 409, the label probably exists but wasn't in our cache
                        if (error?.code === 409 || error?.response?.status === 409) {
                            this.logger.warn('Label creation conflict, refreshing labels and retrying...', { label: label.name });
                            // Force cache expiry and retry getting labels
                            this.gmailLabelsExpireAt = null;
                            const refreshedLabels = await this.listGmailLabels({ forceRefresh: true });
                            this.logger.info('Refreshed Gmail labels:', { "labels": refreshedLabels.map(l => l.name) });
                            gmailLabel = refreshedLabels.find(l => l.name === label.name);

                            if (gmailLabel) {
                                return gmailLabel;
                            }
                            // If we still can't find it, something else is wrong
                            throw new Error(`Unable to find or create label: ${label.name}`);
                        }
                        this.logger.error(`Failed to create Gmail label: [${label.name}]`, { error });
                        throw error;
                    }
                }
                return gmailLabel;
            } catch (error) {
                this.logger.error(`Error in getOrCreateGmailLabel: [${label.name}]`, { error });
                throw error;
            }
        });
    }

    /**
     * Categorises an email if not already labelled.
     * It extracts the subject, sender, snippet for body and timestamp from the Gmail message,
     * then passes these details to the LLMCategoriser for a categorisation label.
     * Finally, it updates the email on Gmail with the new label.
     * @param gmail_message - A Gmail message object.
     * @returns The updated Gmail message object with the applied categorisation label.
     */
    public async categoriseEmail(
        { email, label }:
            { email: Email, label: ILabel }
    ): Promise<Email> {
        if (!email.messageId) {
            throw new Error("Email does not have an id.");
        }
        const gmailLabel = await this.getOrCreateGmailLabel(label);

        // Use the label ID instead of name
        await (await this.getHttpGoogleClient()).users.messages.modify({
            userId: 'me',
            id: email.messageId,
            requestBody: {
                addLabelIds: [gmailLabel.id!],
            },
        });

        // Append the new label to the email's labelIds and return the updated email.
        if (!email.labels) {
            email.labels = [];
        }
        if (!email.labels.includes(label.name)) {
            email.labels.push(label.name);
        }

        this.logger.info(`Email categorised with subject: ${email.subject} -> Label: ${label.name}`);
        this.fyxerActionRepo.create({
            actionName: 'categoriseEmail',
            actionData: JSON.stringify({
                email: email,
                label: label,
            }),
            createdAt: new Date(),
        });
        return email;
    }

    private async appendHistoryIdToProcessedObjectHistoryIfNew({ historyId, email }: { historyId: number, email: Email }): Promise<void> {
        // Check if the email has already been processed from the db, if not, process it
        const processedObject = await this.processedObjectRepo.findByTimeRange({
            lastNHours: 24,
            objectType: ObjectType.EMAIL
        });
        if (!processedObject) {
            // Save to processed objects log
            await this.processedObjectRepo.save({
                project_id: email.threadId, // You might want to implement proper project ID logic
                thread_id: email.threadId,
                message_id: email.messageId,
                type: ObjectType.EMAIL,
                result: JSON.stringify(email),
                object_timestamp: new Date(email.timestamp)
            });
        }
    }
} 