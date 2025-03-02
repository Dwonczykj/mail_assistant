import { Injectable, Inject } from '@nestjs/common';
import { OAuth2Client, Credentials } from 'google-auth-library';
import { IEmailClient } from './IEmailClient';
import { Email } from '../models/Email';
import { ILabel } from '../models/Label';
import { ILogger } from '../lib/logger/ILogger';
import { IFyxerActionRepository } from './IFyxerActionRepository';
// import { AuthEnvironment, GoogleAuthFactoryService } from '../lib/auth/services/google-auth-factory.service';
import { IGoogleAuthService, IGoogleAuthService2 } from '../lib/auth/interfaces/google-auth.interface';
import { config } from '../Config/config';
import { ExchangeAdaptor } from '../models/ExchangeAdaptor';
import { ILockable } from '../lib/auth/interfaces/ILockable';

/**
 * Microsoft Exchange Email Client implementation
 * Connects to Microsoft Exchange email accounts and implements the IEmailClient interface
 */
@Injectable()
export class ExchangeClient extends ILockable implements IEmailClient {
    public readonly name: string = "exchange";
    private readonly emailAdaptor: ExchangeAdaptor = new ExchangeAdaptor();
    private exchangeLabels: any[] = [];
    private exchangeLabelsExpireAt: Date | null = null;


    constructor(
        @Inject('ILogger') private readonly logger: ILogger,
        @Inject('IFyxerActionRepository') private readonly fyxerActionRepo: IFyxerActionRepository,
        @Inject('IGoogleAuthService') private readonly googleAuthService: IGoogleAuthService2,
    ) {
        super();
    }

    private async getExchangeClientAccessToken(): Promise<string> {
        const exchangeClientAccessToken = await this.googleAuthService.getAuthenticatedClient();
        const accessToken = exchangeClientAccessToken?.credentials?.access_token;
        if (!accessToken) {
            throw new Error('Exchange client not authenticated');
        }
        return accessToken;
    }

    /**
     * Listens for incoming emails using Microsoft Exchange subscription API.
     * Sets up notifications for new emails in the inbox.
     * Uses Microsoft Graph API (or the older Outlook REST API, if applicable) to create a webhook subscription on the mailbox. 
     * It subscribes to changes (for example, new messages in the Inbox) by specifying a callback URL to the webapi webhook.
     */
    public async listenForIncomingEmails(): Promise<void> {
        try {
            const accessToken = await this.getExchangeClientAccessToken();
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