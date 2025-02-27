import { Injectable, Inject } from '@nestjs/common';
import { OAuth2Client, Credentials } from 'google-auth-library';
import { IEmailClient } from './IEmailClient';
import { IHaveGoogleClient, IReceiveOAuthClient } from '../lib/utils/IGoogleAuth';
import { Email } from '../models/Email';
import { ILabel } from '../models/Label';
import { ILogger } from '../lib/logger/ILogger';
import { IFyxerActionRepository } from './IFyxerActionRepository';
import { AuthEnvironment, GoogleAuthFactoryService } from '../lib/auth/services/google-auth-factory.service';
import { IGoogleAuthService } from '../lib/auth/interfaces/google-auth.interface';
import { config } from '../Config/config';
import { ExchangeAdaptor } from '../models/ExchangeAdaptor';

/**
 * Microsoft Exchange Email Client implementation
 * Connects to Microsoft Exchange email accounts and implements the IEmailClient interface
 */
@Injectable()
export class ExchangeClient implements IEmailClient, IHaveGoogleClient<any> {
    private authClient: OAuth2Client | null = null;
    private _httpGoogleClient: any | null = null;
    private credentials: Credentials | null = null;
    private readonly emailAdaptor: ExchangeAdaptor;
    private exchangeLabels: any[] = [];
    private exchangeLabelsExpireAt: Date | null = null;
    private labelCreationLock: Promise<void> = Promise.resolve();
    public readonly name: string = "exchange";
    private googleAuthService: IGoogleAuthService;

    public get httpGoogleClient(): any | null {
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
        this.authClient = null;
        this.emailAdaptor = new ExchangeAdaptor();
        this.googleAuthService = this.googleAuthFactoryService.getAuthService(this.environment);
    }

    public async authenticate({ oAuthClient }: { oAuthClient: OAuth2Client }): Promise<void> {
        this.authClient = oAuthClient;
        if (!this.authClient || !this.authClient.credentials.refresh_token) {
            const newCreds = await this.googleAuthService.refreshTokenIfNeeded();
            this.authClient.setCredentials({
                access_token: newCreds.accessToken,
                refresh_token: newCreds.refreshToken,
                expiry_date: newCreds.expiryDate ? newCreds.expiryDate.getTime() : null,
            });
        }

        // Initialize Microsoft Exchange client here
        // This is a placeholder - actual implementation would use Microsoft Graph API or Exchange Web Services
        this._httpGoogleClient = {}; // Placeholder for Exchange client

        this.logger.info('Exchange client authenticated');
    }

    public async needsTokenRefresh(): Promise<boolean> {
        return this.googleAuthService.needsTokenRefresh();
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
     * @returns A function to release the lock.
     */
    private acquireLock(): Promise<() => void> {
        let unlockNext: () => void;
        const previousLock = this.labelCreationLock;
        this.labelCreationLock = new Promise<void>((resolve) => {
            unlockNext = resolve;
        });

        return previousLock.then(() => unlockNext);
    }

    private async refreshAuthClient(): Promise<void> {
        const newCreds = await this.googleAuthService.refreshTokenIfNeeded();
        if (!this.authClient) {
            throw new Error('Exchange client not authenticated');
        }
        this.authClient.setCredentials({
            access_token: newCreds.accessToken,
            refresh_token: newCreds.refreshToken,
            expiry_date: newCreds.expiryDate ? newCreds.expiryDate.getTime() : null,
        });

        // Refresh Exchange client connection
        // Placeholder for actual implementation
        this._httpGoogleClient = {}; // Placeholder for Exchange client
    }

    /**
     * Listens for incoming emails using Microsoft Exchange subscription API.
     * Sets up notifications for new emails in the inbox.
     * Uses Microsoft Graph API (or the older Outlook REST API, if applicable) to create a webhook subscription on the mailbox. 
     * It subscribes to changes (for example, new messages in the Inbox) by specifying a callback URL to the webapi webhook.
     */
    public async listenForIncomingEmails(): Promise<void> {
        try {
            // Check if we have valid auth
            if (!this.authClient || !this.httpGoogleClient) {
                this.logger.error('Exchange client not authenticated');
                throw new Error('Exchange client not authenticated. Please authenticate first.');
            }

            // Check token validity and refresh if needed
            try {
                await this.refreshAuthClient();
                if (!this.authClient?.credentials.access_token) {
                    throw new Error('No valid access token');
                }
            } catch (error) {
                this.logger.error('Failed to get access token', { "error": error });
                throw error;
            }

            const accessToken = this.authClient?.credentials.access_token;
            const refreshToken = this.authClient?.credentials.refresh_token;
            const expiryDate = this.authClient?.credentials.expiry_date;

            if (!accessToken) {
                throw new Error('No valid access token for Exchange client');
            }
            const response = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    changeType: 'created',
                    notificationUrl: config.exchange.subscriptionUrl, // Your endpoint
                    resource: 'me/mailFolders/inbox/messages',
                    expirationDateTime: new Date(Date.now() + 3600000).toISOString(), // e.g., 1 hour from now; renew before expiry
                    clientState: 'yourSecretClientState' // for validation purposes
                })
            });
            const data = await response.json();
            this.logger.info('Graph subscription created:', data);

            // Set up subscription for new emails
            // This is a placeholder - actual implementation would use Microsoft Graph API subscriptions
            this.logger.info('Set up Exchange email subscription');

            // Placeholder for subscription setup
            // In a real implementation, this would create a subscription to receive notifications
            // when new emails arrive in the inbox

        } catch (error: any) {
            this.logger.error(`Failed to set up Exchange email subscription with error: ${error}`, { "error": error.toString() });
            throw error;
        }
    }

    public async killIncomingEmailListener(): Promise<void> {
        try {
            // Delete subscription for new emails
            // This is a placeholder - actual implementation would delete Microsoft Graph API subscription

            this.logger.info('Killed incoming email listener for Exchange');
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
            // Calculate the date for filtering emails
            const afterDate = new Date(Date.now() - lastNHours * 60 * 60 * 1000);

            this.logger.info(`Fetching last ${count} emails from Exchange after ${afterDate.toISOString()}`);

            // Placeholder for actual implementation
            // In a real implementation, this would use Microsoft Graph API to fetch emails
            // Example: GET /me/messages?$filter=receivedDateTime ge 2023-01-01T00:00:00Z&$top=10&$orderby=receivedDateTime desc

            // Mock response for placeholder
            const mockMessages: any[] = [];

            // Convert Exchange messages to our Email model
            return mockMessages.map(this.emailAdaptor.adapt);
        } catch (error) {
            this.logger.error('Failed to fetch emails from Exchange:', { "error": error });
            throw error;
        }
    }

    private async listExchangeLabels({
        forceRefresh = false
    }: {
        forceRefresh?: boolean
    } = {}): Promise<any[]> {
        if (!this.isExchangeLabelsExpired() && !forceRefresh) {
            return this.exchangeLabels;
        }

        // Placeholder for actual implementation
        // In a real implementation, this would fetch categories/folders from Exchange
        // Example: GET /me/mailFolders or GET /me/outlook/masterCategories

        this.exchangeLabels = []; // Placeholder
        this.exchangeLabelsExpireAt = new Date(Date.now() + 1000 * 60 * 5); // 5 minutes
        return this.exchangeLabels;
    }

    private isExchangeLabelsExpired(): boolean {
        return this.exchangeLabelsExpireAt ? this.exchangeLabelsExpireAt < new Date() : true;
    }

    private async getOrCreateExchangeLabel(label: ILabel): Promise<any> {
        return this.withLock(async () => {
            try {
                // Force refresh labels to ensure we have the latest
                const exchangeLabels = await this.listExchangeLabels();
                let exchangeLabel = exchangeLabels.find(l => l.name === label.name);

                if (!exchangeLabel) {
                    try {
                        // Placeholder for actual implementation
                        // In a real implementation, this would create a new category or folder in Exchange
                        // Example: POST /me/outlook/masterCategories

                        const newLabel = { id: `label-${Date.now()}`, name: label.name }; // Placeholder
                        this.logger.info('Created Exchange label:', { "label": newLabel });
                        this.exchangeLabels.push(newLabel);
                        return newLabel;
                    } catch (error: any) {
                        // Handle potential conflicts
                        if (error?.code === 409 || error?.response?.status === 409) {
                            this.logger.warn('Label creation conflict, refreshing labels and retrying...', { label: label.name });
                            this.exchangeLabelsExpireAt = null;
                            const refreshedLabels = await this.listExchangeLabels({ forceRefresh: true });
                            this.logger.info('Refreshed Exchange labels:', { "labels": refreshedLabels.map(l => l.name) });
                            exchangeLabel = refreshedLabels.find(l => l.name === label.name);

                            if (exchangeLabel) {
                                return exchangeLabel;
                            }
                            throw new Error(`Unable to find or create label: ${label.name}`);
                        }
                        this.logger.error(`Failed to create Exchange label: [${label.name}]`, { error });
                        throw error;
                    }
                }
                return exchangeLabel;
            } catch (error) {
                this.logger.error(`Error in getOrCreateExchangeLabel: [${label.name}]`, { error });
                throw error;
            }
        });
    }

    /**
     * Categorises an email by applying a label/category to it in Exchange.
     * @param email - The email to categorize
     * @param label - The label to apply
     * @returns The updated email with the applied label
     */
    public async categoriseEmail(
        { email, label }:
            { email: Email, label: ILabel }
    ): Promise<Email> {
        if (!email.messageId) {
            throw new Error("Email does not have an id.");
        }

        const exchangeLabel = await this.getOrCreateExchangeLabel(label);

        // Placeholder for actual implementation
        // In a real implementation, this would apply a category to an email in Exchange
        // Example: PATCH /me/messages/{id} with categories in the body

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