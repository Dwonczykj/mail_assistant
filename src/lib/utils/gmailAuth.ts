import { google } from 'googleapis';
import { Credentials, OAuth2Client } from 'google-auth-library';
import { authenticate } from '@google-cloud/local-auth';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import Redis from 'ioredis';
import { container } from 'tsyringe';
import process from 'process';
import { config } from '../../Config/config';
import { ILogger } from '../logger/ILogger';
import { openUrl } from './openUrl'; // Added cross-platform URL opener using child_process
import { IGmailAuth } from './IGmailAuth';
import { redisConfig } from '../redis/RedisConfig';
import { inject, injectable } from 'tsyringe';




abstract class GoogleAuth implements IGmailAuth {
    private authClient: OAuth2Client | null = null;
    constructor(
        @inject('REDIS_CLIENT') private readonly redis: Redis,
        @inject('ILogger') private readonly logger: ILogger
    ) { }

    abstract oauth: {
        token: string;
        expiry: string;
    };

    abstract type: 'daemon' | 'web';


    async initializeGoogleClient(): Promise<OAuth2Client> {
        this.authClient = await this.initializeGoogleClientInternal();
        return this.authClient;
    }

    private async initializeGoogleClientInternal({ useFileCredentials }: { useFileCredentials?: boolean } = { useFileCredentials: true }): Promise<OAuth2Client> {
        // First check for redis token and expiry and return


        // TODO: REDIS Keys need to differentiate their names for web and daemon
        const clientFromRedis = await this.loadSavedCredentialsFromRedis();
        if (clientFromRedis) {
            return clientFromRedis;
        }
        // Second check for file token and expiry and return
        const clientFromFile = await this.loadSavedCredentialsSessionTokenIfExist({ tokenPath: config.tokenPath[this.type] });
        if (clientFromFile) {
            return clientFromFile;
        }
        // Third, if none of the above, authorize and return
        let client: OAuth2Client;
        if (useFileCredentials) {
            client = new OAuth2Client({
                clientId: config.googleClientId,
                clientSecret: config.googleClientSecret,
                redirectUri: config.googleRedirectUri,
            });
        } else {
            client = await authenticate({
                scopes: config.google.scopes,
                keyfilePath: config.credentialsPath[this.type],
            });
        }
        if (client.credentials) {
            await this.saveSessionToken(client);
        }
        return client;
    }

    public async handleOAuthCallback({ code, authProvider, }: { code: string, authProvider: IGmailAuth, }): Promise<void> {
        if (!this.authClient) {
            this.authClient = new OAuth2Client();
        }

        const { tokens } = await this.authClient.getToken(code);
        this.authClient.setCredentials(tokens);
        const credentials = tokens;
        await this.saveSessionToken(this.authClient);
        this.logger.info('OAuth2 tokens received and set');
    }

    public getAuthUrl(): string {
        if (!this.authClient) {
            throw new Error('OAuth2 client not configured');
        }

        return this.authClient.generateAuthUrl({
            access_type: 'offline',
            scope: config.google.scopes,
        });
    }

    /**
     * Loads the saved credentials from redis.
     * @returns The saved credentials or null if none found.
     */
    private async loadSavedCredentialsFromRedis(): Promise<OAuth2Client | null> {
        let client: OAuth2Client;
        const [token, expiry] = await Promise.all([
            this.redis.get(this.oauth.token),
            this.redis.get(this.oauth.expiry)
        ]);
        if (token && expiry && Date.now() < parseInt(expiry)) {
            client = new OAuth2Client();
            const credentials: Credentials = {
                access_token: token,
                expiry_date: parseInt(expiry)
            };
            client.setCredentials(credentials);
            return client;
        }
        return null;
    }

    private async loadSavedCredentialsSessionTokenIfExist({
        tokenPath,
    }: {
        tokenPath: string;
    }): Promise<OAuth2Client | null> {
        try {
            const tokenStr = await fs.promises.readFile(tokenPath, 'utf-8');
            const token = JSON.parse(tokenStr);
            if (token) {
                let expiry: number | undefined;
                // Prefer `expiry_date` (milliseconds) if it exists; otherwise parse the ISO string from `expiry`
                if (token.expiry_date) {
                    expiry = token.expiry_date;
                } else if (token.expiry) {
                    expiry = Date.parse(token.expiry);
                }
                if (expiry && Date.now() > expiry - 60000) {
                    console.log("Stored token has expired on " + new Date(expiry).toISOString() + " or is about to expire. Ignoring old token and initiating new OAuth flow.");
                    // Optionally remove the old token file so it won't be used next time.
                    fs.unlinkSync(tokenPath);
                    return null;
                } else {
                    return google.auth.fromJSON(token) as OAuth2Client;
                }
            }
            return null;
        } catch (err) {
            return null;
        }
    }

    /**
     * Gets the clientId and secret from the credentials file and saves the refresh token to the token file and redis cache.
     * @param client The OAuth2 client to save.
     */
    private async saveSessionToken(client: OAuth2Client) {
        // Save to file
        const content = await fs.promises.readFile(config.credentialsPath[this.type], 'utf-8');
        const keys = JSON.parse(content);
        const key = keys.installed || keys.web;
        const payload = JSON.stringify({
            type: 'authorized_user',
            client_id: key.client_id,
            client_secret: key.client_secret,
            refresh_token: client.credentials.refresh_token,
        });
        await fs.promises.writeFile(config.tokenPath[this.type], payload);

        // Save to redis
        const expiryDate = client.credentials.expiry_date;
        const token = client.credentials.access_token;
        if (expiryDate && token) {
            await this.redis.set(this.oauth.token, token);
            await this.redis.set(this.oauth.expiry, expiryDate.toString());
        }

        return client;
    }
}

@injectable()
export class GoogleAuthForDaemon extends GoogleAuth implements IGmailAuth {
    constructor(
        @inject('REDIS_CLIENT') redis: Redis,
        @inject('ILogger') logger: ILogger
    ) {
        super(redis, logger);
    }

    oauth = {
        token: redisConfig.keys.gmail.daemon.oauth.token,
        expiry: redisConfig.keys.gmail.daemon.oauth.expiry
    }
    type: 'daemon' = 'daemon';
}
@injectable()
export class GoogleAuthForWeb extends GoogleAuth implements IGmailAuth {
    constructor(
        @inject('REDIS_CLIENT') redis: Redis,
        @inject('ILogger') logger: ILogger
    ) {
        super(redis, logger);
    }

    oauth = {
        token: redisConfig.keys.gmail.web.oauth.token,
        expiry: redisConfig.keys.gmail.web.oauth.expiry
    }
    type: 'web' = 'web';
}

/**
 * DEPRECATED: included for example demonstration.
 * Lists documents from the user's Google Drive.
 * @param auth The authenticated OAuth2 client.
 */
async function listDocuments(auth: OAuth2Client) {
    const logger: ILogger = container.resolve<ILogger>('ILogger');
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.document'",
        fields: 'files(id, name)',
    });
    const documents = res.data.files;
    if (!documents || documents.length === 0) {
        logger.info('No documents found.');
        return;
    }
    logger.info('Documents:');
    documents.forEach((doc) => {
        logger.info(`${doc.name} (${doc.id})`);
    });
}

