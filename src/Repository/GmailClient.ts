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
import { pubSubConfig } from '../Config/pubSubConfig';
import { IGoogleAuth } from '../lib/utils/IGoogleAuth';
import { Injectable, Inject } from '@nestjs/common';

@Injectable()
export class GmailClient implements IEmailClient {
    private static instance: GmailClient | null = null;
    private authClient: OAuth2Client | null = null;
    private httpEmailServerClient: gmail_v1.Gmail | null = null;
    private credentials: Credentials | null = null;
    private readonly emailAdaptor: GmailAdaptor;
    private gmailLabels: gmail_v1.Schema$Label[] = [];
    private gmailLabelsExpireAt: Date | null = null;
    private labelCreationLock: Promise<void> = Promise.resolve();
    public readonly name: string = "gmail";

    public get credentials_access_token(): string | null {
        return this.credentials?.access_token || null;
    }

    public get credentials_expiry_date(): number | null {
        return this.credentials?.expiry_date || null;
    }

    constructor(
        @Inject('ILogger') private readonly logger: ILogger,
        @Inject('IFyxerActionRepository') private readonly fyxerActionRepo: IFyxerActionRepository,
        @Inject('IGoogleAuth') private readonly authProvider: IGoogleAuth,
    ) {
        this.authClient = null;
        this.emailAdaptor = new GmailAdaptor();
        const instance = this;
        this.authProvider.initializeGoogleClient().then((authClient) => {
            instance.authClient = authClient;
            instance.httpEmailServerClient = google.gmail({ version: 'v1', auth: instance.authClient });
        });
    }

    private async withLock<T>(operation: () => Promise<T>): Promise<T> {
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
    private acquireLock(): Promise<() => void> {
        let unlockNext: () => void;
        const previousLock = this.labelCreationLock;
        this.labelCreationLock = new Promise<void>((resolve) => {
            unlockNext = resolve;
        });

        return previousLock.then(() => unlockNext);
    }

    /**
   * Listens for incoming emails using Gmail API's watch functionality.
   * It sets up push notifications on the "INBOX" by using a webhook/topic that is setup in the Google Cloud Pub/Sub console and routes to our WebAPI application.
   */
    public async listenForIncomingEmails(): Promise<void> {
        const topicName: string = config.google.gmailTopic || pubSubConfig.topicName;
        try {
            // Check if we have valid auth
            if (!this.authClient || !this.httpEmailServerClient) {
                this.logger.error('Gmail client not authenticated');
                throw new Error('Gmail client not authenticated. Please authenticate first.');
            }

            // Check token validity and refresh if needed
            try {
                const credentials = await this.authClient.getAccessToken();
                if (!credentials || !credentials.token) {
                    throw new Error('No valid access token');
                }
            } catch (error) {
                // Token might be expired, try to refresh
                if (error instanceof Error && error.message.includes('No access token')) {
                    await this.authProvider.refreshToken();
                    // Reinitialize client with new token
                    this.authClient = await this.authProvider.initializeGoogleClient();
                    this.httpEmailServerClient = google.gmail({ version: 'v1', auth: this.authClient });
                } else {
                    throw error;
                }
            }

            const subscriptionName: string = config.google.gmailSubscription || pubSubConfig.subscriptionName;
            const res = await this.httpEmailServerClient.users.watch({
                userId: 'me',
                requestBody: {
                    labelIds: ['INBOX'],
                    topicName: topicName,
                },
            });

            this.logger.info('Watch response:', { "response": res.data });
        } catch (error: any) {
            this.logger.error(`Failed to set up email watch for topic: ${topicName} with error: ${error}`, { "error": error.toString() });
            throw error;
        }
    }

    public async killIncomingEmailListener(): Promise<void> {
        const topicName: string = config.google.gmailTopic || pubSubConfig.topicName;
        const subscriptionName: string = config.google.gmailSubscription || pubSubConfig.subscriptionName;
        try {
            // // Check if we have valid auth
            // if (!this.authClient || !this.httpEmailServerClient) {
            //     this.logger.error('Gmail client not authenticated');
            //     throw new Error('Gmail client not authenticated. Please authenticate first.');
            // }

            // // Check token validity and refresh if needed
            // try {
            //     const credentials = await this.authClient.getAccessToken();
            //     if (!credentials || !credentials.token) {
            //         throw new Error('No valid access token');
            //     }
            // } catch (error) {
            //     // Token might be expired, try to refresh
            //     if (error instanceof Error && error.message.includes('No access token')) {
            //         await this.authProvider.refreshToken();
            //         // Reinitialize client with new token
            //         this.authClient = await this.authProvider.initializeGoogleClient();
            //         this.httpEmailServerClient = google.gmail({ version: 'v1', auth: this.authClient });
            //     } else {
            //         throw error;
            //     }
            // }

            await this.httpEmailServerClient?.users.stop({
                userId: 'me',
            });

            this.logger.info('Killed incoming email listener');
        } catch (error: any) {
            this.logger.error(`Failed to kill incoming email listener with error: ${error}`, { "error": error.toString() });
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
            const listResponse = await this.httpEmailServerClient!.users.messages.list({
                userId: 'me',
                maxResults: count,
                q: `after:${lastNHours ? new Date(Date.now() - lastNHours * 60 * 60 * 1000).toISOString() : ''}`
            });

            const messagesList = listResponse.data.messages || [];

            const messagePromises = messagesList.map(async (msg) => {
                const msgDetail = await this.httpEmailServerClient!.users.messages.get({
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
        const labelResponse = await this.httpEmailServerClient!.users.labels.list({
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
                        const createResponse = await this.httpEmailServerClient!.users.labels.create({
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
        await this.httpEmailServerClient!.users.messages.modify({
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