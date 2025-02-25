import { google } from 'googleapis';
import { Credentials, OAuth2Client } from 'google-auth-library';
import Redis from 'ioredis';
import { config } from '../../Config/config';
import { ILogger } from '../logger/ILogger';
import { IGoogleAuth } from './IGoogleAuth';
import { redisConfig } from '../redis/RedisConfig';
import { Inject, Injectable } from '@nestjs/common';



@Injectable()
abstract class GoogleAuth implements IGoogleAuth {
    private oAuth2Client: OAuth2Client | null = null;
    constructor(
        @Inject('REDIS_CLIENT') private readonly redis: Redis,
        @Inject('ILogger') private readonly logger: ILogger
    ) { }

    abstract oauth: {
        token: string;
        expiry: string;
        refreshToken: string;
    };

    abstract type: 'daemon' | 'web';


    async initializeGoogleClient(): Promise<OAuth2Client> {
        this.oAuth2Client = await this.initializeGoogleClientInternal({ useFileCredentials: this.type === 'daemon' });
        return this.oAuth2Client;
    }

    private async initializeGoogleClientInternal({ useFileCredentials }: { useFileCredentials?: boolean } = { useFileCredentials: true }): Promise<OAuth2Client> {
        let client: OAuth2Client;
        // Change from useFileCredentials to false to use the redis cache instead of the file credentials in all cases to avoid file system access which is not available in the web context.
        if (false) {
            this.logger.debug("Initializing Google client with file credentials");
            const { authenticate } = await import('@google-cloud/local-auth');
            client = await authenticate({
                scopes: config.google.scopes,
                keyfilePath: config.credentialsPath[this.type],
            });
        } else {
            client = new OAuth2Client({
                clientId: config.googleClientId,
                clientSecret: config.googleClientSecret,
                redirectUri: config.googleRedirectUri,
            });
        }

        await this.loadSavedCredentialsFromRedis({ client });
        if (client.credentials) {
            await this.saveSessionToken(client);
        }

        return client;
    }

    public async handleOAuthCallback({ code }: { code: string }): Promise<void> {
        if (!this.oAuth2Client) {
            this.oAuth2Client = new OAuth2Client({
                clientId: config.googleClientId,
                clientSecret: config.googleClientSecret,
                redirectUri: config.googleRedirectUri,
            });
        }

        const { tokens } = await this.oAuth2Client.getToken(code);
        this.oAuth2Client.setCredentials(tokens);
        const credentials = tokens;
        await this.saveSessionToken(this.oAuth2Client);
        this.logger.info('OAuth2 tokens received and set');
    }

    public getAuthUrl(): string {
        if (!this.oAuth2Client) {
            throw new Error('OAuth2 client not configured');
        }

        return this.oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: config.google.scopes,
            prompt: 'consent', // Force consent screen to ensure refresh token
        });
    }

    async getCredentials(): Promise<Credentials | null> {
        if (!this.oAuth2Client) {
            return null;
        }
        return this.oAuth2Client.credentials;
    }

    async refreshToken(): Promise<void> {
        if (!this.oAuth2Client) {
            throw new Error('OAuth2Client not initialized');
        }

        try {
            const refreshToken = await this.redis.get(this.oauth.refreshToken);
            if (!refreshToken) {
                throw new Error('No refresh token available');
            }

            this.oAuth2Client.setCredentials({
                refresh_token: refreshToken
            });

            const { credentials } = await this.oAuth2Client.refreshAccessToken();

            // Update Redis with new tokens
            await Promise.all([
                this.redis.set(redisConfig.keys.gmail.web.oauth.token, credentials.access_token!),
                credentials.refresh_token && this.redis.set(
                    redisConfig.keys.gmail.web.oauth.refreshToken,
                    credentials.refresh_token
                ),
                credentials.expiry_date && this.redis.set(
                    redisConfig.keys.gmail.web.oauth.expiry,
                    credentials.expiry_date.toString()
                )
            ]);
        } catch (error) {
            this.logger.error('Failed to refresh token:', { error: `${error}` });
            throw error;
        }
    }

    /**
     * Loads the saved credentials from redis.
     * @returns The saved credentials or null if none found.
     */
    private async loadSavedCredentialsFromRedis({ client }: { client?: OAuth2Client }): Promise<OAuth2Client | null> {
        const [accessToken, refreshToken, expiry] = await Promise.all([
            this.redis.get(redisConfig.keys.gmail.web.oauth.token),
            this.redis.get(redisConfig.keys.gmail.web.oauth.refreshToken),
            this.redis.get(redisConfig.keys.gmail.web.oauth.expiry)
        ]);
        if (accessToken && refreshToken && expiry && Date.now() < parseInt(expiry)) {
            client = client ?? new OAuth2Client();
            const credentials: Credentials = {
                access_token: accessToken,
                refresh_token: refreshToken,
                expiry_date: parseInt(expiry)
            };
            client.setCredentials(credentials);
            return client;
        }
        return null;
    }

    public async redisCacheAuthValid(): Promise<boolean> {
        return !!(await this.loadSavedCredentialsFromRedis({}));
    }

    /**
     * DEPRECATED
     * @param tokenPath The path to the token file.
     * @returns The OAuth2 client or null if no token found.
     */
    private async loadSavedCredentialsSessionTokenIfExist({
        tokenPath,
    }: {
        tokenPath: string;
    }): Promise<OAuth2Client | null> {
        try {
            const { readFile, unlink } = await import('fs/promises');
            const tokenStr = await readFile(tokenPath, 'utf-8');
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
                    await unlink(tokenPath);
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
        if (false) {
            const { readFile, writeFile } = await import('fs/promises');
            const content = await readFile(config.credentialsPath[this.type], 'utf-8');
            const keys = JSON.parse(content);
            const key = keys.installed || keys.web;
            const payload = JSON.stringify({
                type: 'authorized_user',
                client_id: key.client_id,
                client_secret: key.client_secret,
                refresh_token: client.credentials.refresh_token,
                expiry_date: client.credentials.expiry_date?.toString() || "0",
                access_token: client.credentials.access_token
            });
            await writeFile(config.tokenPath[this.type], payload);
        }

        // Save to redis
        const expiryDate = client.credentials.expiry_date;
        const accessToken = client.credentials.access_token;
        const refreshToken = client.credentials.refresh_token;
        if (accessToken) {
            await this.redis.set(this.oauth.token, accessToken);
            await this.redis.set(this.oauth.expiry, expiryDate?.toString() || "0");
            await this.redis.set(this.oauth.refreshToken, refreshToken || '');
        }

        return client;
    }
}

@Injectable()
export class GoogleAuthForDaemon extends GoogleAuth implements IGoogleAuth {
    constructor(
        @Inject('REDIS_CLIENT') redis: Redis,
        @Inject('ILogger') logger: ILogger
    ) {
        super(redis, logger);
    }

    oauth = {
        token: redisConfig.keys.gmail.daemon.oauth.token,
        expiry: redisConfig.keys.gmail.daemon.oauth.expiry,
        refreshToken: redisConfig.keys.gmail.daemon.oauth.refreshToken
    }
    type: 'daemon' = 'daemon';
}
@Injectable()
export class GoogleAuthForWeb extends GoogleAuth implements IGoogleAuth {
    constructor(
        @Inject('REDIS_CLIENT') redis: Redis,
        @Inject('ILogger') logger: ILogger
    ) {
        super(redis, logger);
    }

    oauth = {
        token: redisConfig.keys.gmail.web.oauth.token,
        expiry: redisConfig.keys.gmail.web.oauth.expiry,
        refreshToken: redisConfig.keys.gmail.web.oauth.refreshToken
    }
    type: 'web' = 'web';

}

/**
 * DEPRECATED: included for example demonstration.
 * Lists documents from the user's Google Drive.
 * @param auth The authenticated OAuth2 client.
 */
async function listDocuments(auth: OAuth2Client, logger: ILogger) {
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

