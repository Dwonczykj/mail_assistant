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
import { IGoogleAuth, IHaveGoogleClient, IReceiveOAuthClient } from '../lib/utils/IGoogleAuth';
import { Injectable, Inject } from '@nestjs/common';
import { AuthEnvironment, GoogleAuthFactoryService } from '../lib/auth/services/google-auth-factory.service';
import { IGoogleAuthService } from '../lib/auth/interfaces/google-auth.interface';
import { Message, Subscription, PubSub } from '@google-cloud/pubsub';
import { EnsureAuthenticated } from '../lib/decorators/ensure-authenticated.decorator';

abstract class ILockable {
    private labelCreationLock: Promise<void> = Promise.resolve();

    protected async withLock<T>(operation: () => Promise<T>): Promise<T> {
        const unlock = await this.acquireLock();
        try {
            return await operation();
        } finally {
            unlock();
        }
    }

    /**
     * Acquires a lock on the label creation process.
     * This ensures that only one label creation can happen at a time.
     * It does it by creating a new promise each time we want mutex lock(){<code>} syntax 
     * so that each promise contains the <code> inside and the promises are chained 
     * so that only next one can start after the previous one has finished.
     * @returns A promise that resolves to a function to release the lock.
     */
    protected acquireLock(): Promise<() => void> {
        let unlockNext: () => void;
        const previousLock = this.labelCreationLock;
        this.labelCreationLock = new Promise<void>((resolve) => {
            unlockNext = resolve;
        });

        return previousLock.then(() => unlockNext);
    }
}

@Injectable()
export class GmailClient extends ILockable implements IEmailClient, IHaveGoogleClient<gmail_v1.Gmail> {
    private static instance: GmailClient | null = null;
    private authClient: OAuth2Client | null = null;
    private _httpGoogleClient: gmail_v1.Gmail | null = null;
    private credentials: Credentials | null = null;
    private readonly emailAdaptor: GmailAdaptor;
    private gmailLabels: gmail_v1.Schema$Label[] = [];
    private gmailLabelsExpireAt: Date | null = null;

    public readonly name: string = "gmail";
    private googleAuthService: IGoogleAuthService;
    private pullPubSubSubscription: Subscription | null = null;
    public get httpGoogleClient(): gmail_v1.Gmail | null {
        return this._httpGoogleClient;
    }

    public get authenticated(): Promise<boolean> {
        return Promise.resolve(this.authClient !== null);
    }

    public get credentials_access_token(): string | null {
        return this.credentials?.access_token || null;
    }

    public get credentials_expiry_date(): number | null {
        return this.credentials?.expiry_date || null;
    }

    constructor(
        @Inject('ILogger') private readonly logger: ILogger,
        @Inject('IFyxerActionRepository') private readonly fyxerActionRepo: IFyxerActionRepository,
        private readonly googleAuthFactoryService: GoogleAuthFactoryService,
        @Inject('APP_ENVIRONMENT') private readonly environment: AuthEnvironment,
    ) {
        super();
        this.authClient = null;
        this.emailAdaptor = new GmailAdaptor();
        this.googleAuthService = this.googleAuthFactoryService.getAuthService(this.environment);
    }

    /**
     * Initializes the Gmail client with an OAuth client.
     * This method should be called once during application startup.
     * After this, the EnsureAuthenticated decorator will handle token refreshes automatically.
     */
    public async authenticate({ oAuthClient }: { oAuthClient: OAuth2Client }): Promise<void> {
        this.authClient = oAuthClient || new OAuth2Client();

        // If we don't have credentials, get them now
        if (!this.authClient.credentials || !this.authClient.credentials.refresh_token) {
            await this.refreshAuthClient();
        } else {
            // Store the credentials for later use
            this.credentials = this.authClient.credentials;
            this._httpGoogleClient = google.gmail({ version: 'v1', auth: this.authClient });
        }

        this.logger.info('Gmail client initialized successfully');
    }



    /**
     * Refreshes the authentication client by getting new tokens if needed
     * This is called automatically by the EnsureAuthenticated decorator
     */
    public async refreshAuthClient(): Promise<void> {
        try {
            if (!this.googleAuthService) {
                this.googleAuthService = this.googleAuthFactoryService.getAuthService(this.environment);
            }
            const newCreds = await this.googleAuthService.refreshTokenIfNeeded();
            if (!this.authClient) {
                this.authClient = new OAuth2Client();
            }

            this.credentials = {
                access_token: newCreds.accessToken,
                refresh_token: newCreds.refreshToken,
                expiry_date: newCreds.expiryDate ? newCreds.expiryDate.getTime() : null,
            };

            this.authClient.setCredentials(this.credentials);
            this._httpGoogleClient = google.gmail({ version: 'v1', auth: this.authClient });
            this.logger.info('Gmail client authentication refreshed successfully');
        } catch (error) {
            this.logger.error('Failed to refresh Gmail client authentication', { error });
            throw error;
        }
    }

    /**
     * Checks if the current token needs to be refreshed
     * @returns true if token refresh is needed, false otherwise
     */
    public async needsTokenRefresh(): Promise<boolean> {
        if (!this.authClient || !this.credentials) {
            return true;
        }

        // Check if we have an expiry date and if it's in the past or within 5 minutes
        const expiryDate = this.credentials.expiry_date;
        if (!expiryDate) {
            return true;
        }

        const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
        return expiryDate < fiveMinutesFromNow;
    }

    /**
     * Listens for incoming emails using Gmail API's watch functionality.
     * It sets up push notifications on the "INBOX" by using a webhook/topic that is setup in the Google Cloud Pub/Sub console and routes to our WebAPI application.
     */
    @EnsureAuthenticated()
    public async listenForIncomingEmails(): Promise<void> {
        const topicName: string = config.google.gmailTopic || gmailPubSubConfig.topicName;
        try {
            // Check if we have valid auth
            if (!this.httpGoogleClient) {
                this.logger.error('Gmail client not authenticated');
                throw new Error('Gmail client not authenticated. Please authenticate first.');
            }

            const res = await this.httpGoogleClient.users.watch({
                userId: 'me',
                requestBody: {
                    labelIds: ['INBOX'],
                    topicName: topicName,
                },
            });
            this.logger.info(`✅👀 Watch added to Gmail: Push Gmails to Pub/Sub topic: ${topicName} with expiration date: ${res.data.expiration ? new Date(Number.parseInt(res.data.expiration)).toLocaleString() : 'unknown'}`, { "response": res.data });
        } catch (error: any) {
            this.logger.error(`❌👀 Failed to set up email watch for topic: ${topicName} with error: ${error}`, { "error": error.toString() });
            throw error;
        }
    }

    @EnsureAuthenticated()
    public async killIncomingEmailListener(): Promise<void> {
        try {
            if (this.httpGoogleClient) {
                await this.httpGoogleClient.users.stop({
                    userId: 'me',
                });
                this.logger.info('✅🧹 Incoming email listener killed');
            }
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
    @EnsureAuthenticated()
    async pullMessagesFromPubSubLoop(): Promise<void> {
        const pubsub = new PubSub();
        const topicName = config.google.pubSubConfig.topicName;
        const subscriptionName = config.google.pubSubConfig.subscriptionName;
        this.pullPubSubSubscription = pubsub.subscription(subscriptionName);
        const messageHandler = async (message: Message) => {
            this.logger.info(`Received message[${message.id}]: ${message.data} \nwith attributes: ${message.attributes}`);
            // Acknowledge the message after processing it
            message.ack();
        }
        this.pullPubSubSubscription.on('message', messageHandler);
        // Optional: handle errors.
        this.pullPubSubSubscription.on('error', error => {
            console.error('Error receiving message:', error);
        });
    }

    @EnsureAuthenticated()
    public async fetchLastEmails({
        count,
        lastNHours = 24
    }: {
        count: number,
        lastNHours?: number
    }): Promise<Email[]> {
        try {
            if (!this.httpGoogleClient) {
                throw new Error('Gmail client not authenticated');
            }

            const query = `after:${lastNHours ? Math.floor(new Date(Date.now() - lastNHours * 60 * 60 * 1000).getTime() / 1000) : ''}`;
            this.logger.info(`Fetching last ${count} emails with query: "q=${query}"`);
            const listResponse = await this.httpGoogleClient.users.messages.list({
                userId: 'me',
                maxResults: count,
                q: query
            });

            const messagesList = listResponse.data.messages || [];

            const messagePromises = messagesList.map(async (msg) => {
                const msgDetail = await this.httpGoogleClient!.users.messages.get({
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

    @EnsureAuthenticated()
    private async listGmailLabels({
        forceRefresh = false
    }: {
        forceRefresh?: boolean
    } = {}): Promise<gmail_v1.Schema$Label[]> {
        if (!this.isGmailLabelsExpired() && !forceRefresh) {
            return this.gmailLabels;
        }

        if (!this.httpGoogleClient) {
            throw new Error('Gmail client not authenticated');
        }

        const labelResponse = await this.httpGoogleClient.users.labels.list({
            userId: 'me'
        });
        this.gmailLabels = labelResponse.data.labels || [];
        this.gmailLabelsExpireAt = new Date(Date.now() + 1000 * 60 * 5); // 5 minutes
        return this.gmailLabels;
    }

    private isGmailLabelsExpired(): boolean {
        return this.gmailLabelsExpireAt ? this.gmailLabelsExpireAt < new Date() : true;
    }

    @EnsureAuthenticated()
    private async getOrCreateGmailLabel(label: ILabel): Promise<gmail_v1.Schema$Label> {
        return this.withLock(async () => {
            try {
                // Force refresh labels to ensure we have the latest
                const gmailLabels = await this.listGmailLabels();
                let gmailLabel = gmailLabels.find(l => l.name === label.name);

                if (!gmailLabel) {
                    try {
                        if (!this.httpGoogleClient) {
                            throw new Error('Gmail client not authenticated');
                        }

                        const createResponse = await this.httpGoogleClient.users.labels.create({
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
    @EnsureAuthenticated()
    public async categoriseEmail(
        { email, label }:
            { email: Email, label: ILabel }
    ): Promise<Email> {
        if (!email.messageId) {
            throw new Error("Email does not have an id.");
        }

        if (!this.httpGoogleClient) {
            throw new Error('Gmail client not authenticated');
        }

        const gmailLabel = await this.getOrCreateGmailLabel(label);

        // Use the label ID instead of name
        await this.httpGoogleClient.users.messages.modify({
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

        this.logger.info(`Email categorised with subject: ${email.subject} -> Label: ${label.name}`, { "email": email });
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
} 