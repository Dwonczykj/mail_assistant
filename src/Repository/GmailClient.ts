import { google } from 'googleapis';
import type { gmail_v1 } from 'googleapis';
import { OAuth2Client, Credentials } from 'google-auth-library';
import { authorize } from '../lib/utils/gmailAuth';
import { config } from '../Config/config';
import { CategoriserFactory } from "../Categoriser/LLMCategoriser";
import { GmailAdaptor } from '../models/GmailAdaptor';
import { IEmailClient } from './IEmailClient';
import { ILabel } from '../models/Label';
import { Email } from '../models/Email';
import { container } from 'tsyringe';
// import { injectable, inject } from 'tsyringe';
import { ILogger } from '../lib/logger/ILogger';


export class GmailClient implements IEmailClient {
    private authClient: OAuth2Client | null = null;
    private static instance: GmailClient | null = null;
    private readonly emailAdaptor: GmailAdaptor;
    private readonly logger: ILogger;
    private credentials: Credentials | null = null;

    public get credentials_access_token(): string | null {
        return this.credentials?.access_token || null;
    }

    public get credentials_expiry_date(): number | null {
        return this.credentials?.expiry_date || null;
    }

    private constructor() {
        this.authClient = null;
        this.emailAdaptor = new GmailAdaptor();
        this.logger = container.resolve<ILogger>('ILogger');
    }

    static async getInstance({
        sender,
    }: {
        sender?: string | undefined,
    }): Promise<GmailClient> {
        if (!GmailClient.instance) {
            GmailClient.instance = new GmailClient();
        }
        if (!GmailClient.instance.authClient) {
            await GmailClient.instance.initAuth();
        }
        return GmailClient.instance;
    }

    /**
     * Ensures that the GmailClient has an authenticated OAuth2 client.
     * If not already authenticated, it initializes authentication.
     * @returns The authenticated OAuth2Client.
     */
    private async initAuth(): Promise<OAuth2Client> {
        // NOTE: ONLY TO BE USED FOR DESKTOP AUTH, NOT FOR WEB API AUTH.
        if (!this.authClient) {
            this.authClient = await authorize();
        }
        return this.authClient;
    }

    /**
   * Listens for incoming emails using Gmail API's watch functionality.
   * It sets up push notifications on the "INBOX" by using a webhook/topic.
   * TODO: This will require the WebAPI application to also be running exposing our webhook.
   */
    public async listenForIncomingEmails(): Promise<void> {
        const authClient = await this.initAuth();
        const gmail = google.gmail({ version: 'v1', auth: authClient });

        try {
            const topicName: string = config.gmailTopic || 'projects/your-project/topics/your-topic';
            const res = await gmail.users.watch({
                userId: 'me',
                requestBody: {
                    labelIds: ['INBOX'],
                    topicName: topicName,
                },
            });

            this.logger.info('Watch response:', { "response": res.data });
        } catch (error) {
            this.logger.error('Failed to set up email watch:', { "error": error });
            throw error;
        }
    }

    public async fetchLastEmails(
        count: number
    ): Promise<Email[]> {
        const authClient = await this.initAuth();
        const gmail = google.gmail({ version: 'v1', auth: authClient });

        try {
            const listResponse = await gmail.users.messages.list({
                userId: 'me',
                maxResults: count,
            });

            const messagesList = listResponse.data.messages || [];

            const messagePromises = messagesList.map(async (msg) => {
                const msgDetail = await gmail.users.messages.get({
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
        const authClient = await this.initAuth();
        const gmail = google.gmail({ version: 'v1', auth: authClient });
        if (!email.messageId) {
            throw new Error("Email does not have an id.");
        }
        await gmail.users.messages.modify({
            userId: 'me',
            id: email.messageId,
            requestBody: {
                addLabelIds: [label.name],
            },
        });

        // Append the new label to the email's labelIds and return the updated email.
        email.labels = [...email.labels, label.name];
        return email;
    }

    public async configureOAuth(
        credentials: {
            clientId: string;
            clientSecret: string;
            redirectUri: string;
    }): Promise<void> {
        this.authClient = new OAuth2Client({
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
            redirectUri: credentials.redirectUri,
        });

        this.logger.info('Google OAuth2 client configured');
    }

    public getAuthUrl(): string {
        if (!this.authClient) {
            throw new Error('OAuth2 client not configured');
        }

        return this.authClient.generateAuthUrl({
            access_type: 'offline',
            scope: [
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/gmail.modify',
                'https://www.googleapis.com/auth/gmail.labels'
            ],
        });
    }

    public async handleOAuthCallback(code: string): Promise<void> {
        if (!this.authClient) {
            throw new Error('OAuth2 client not configured');
        }

        const { tokens } = await this.authClient.getToken(code);
        this.authClient.setCredentials(tokens);
        this.credentials = tokens;

        this.logger.info('OAuth2 tokens received and set');
    }
} 