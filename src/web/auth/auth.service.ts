import { Injectable, Inject } from '@nestjs/common';
import { GmailClient } from '../../Repository/GmailClient';
import { config } from '../../Config/config';
import Redis from 'ioredis';
import { ILogger } from '../../lib/logger/ILogger';
import { redisConfig } from '../../lib/redis/RedisConfig';

@Injectable()
export class AuthService {
    constructor(
        @Inject('REDIS_CLIENT')
        private readonly redis: Redis,
        @Inject('ILogger')
        private readonly logger: ILogger // TODO: Fix this to use the ILogger that we already defined in our container.
    ) { }

    private readonly TOKEN_KEY = redisConfig.keys.gmail.oauth.token;
    private readonly TOKEN_EXPIRY_KEY = redisConfig.keys.gmail.oauth.expiry;

    async getGoogleAuthUrl(): Promise<string> {
        const [token, expiry] = await Promise.all([
            this.redis.get(this.TOKEN_KEY),
            this.redis.get(this.TOKEN_EXPIRY_KEY)
        ]);
        // Check if a valid token is already cached
        if (token && expiry && Date.now() < parseInt(expiry)) {
            this.logger.debug("Valid access token already exists. Skipping new OAuth configuration.");
            return "ALREADY_AUTHENTICATED"; // Returning this special flag indicates authentication is complete.
        }

        const gmailClient = await GmailClient.getTemporaryInstance({ sender: "webapi" });
        this.logger.debug("No valid token found. Configuring OAuth...");
        await gmailClient.configureOAuth({
            clientId: config.googleClientId,
            clientSecret: config.googleClientSecret,
            redirectUri: config.googleRedirectUri,
        });
        const authUrl = gmailClient.getAuthUrl();
        this.logger.debug(`OAuth URL generated: ${authUrl}`);
        return authUrl;
    }

    async handleGoogleCallback(code: string, sender: string): Promise<void> {
        const gmailClient = await GmailClient.getTemporaryInstance({ sender: "webapi" }); // NOTE: We only use webapi callbacks now from requests to Authenticate Google Auth that initiated from the web server.
        this.logger.debug(`Handling OAuth callback with code: ${code}`);
        // Assume handleOAuthCallback returns an object { access_token, expires_in: number }
        await gmailClient.handleOAuthCallback(code);
        // if (gmailClient.credentials_access_token && gmailClient.credentials_expiry_date && gmailClient.credentials_expiry_date > Date.now()) {
        //     await Promise.all([
        //         this.redis.set(this.TOKEN_KEY, gmailClient.credentials_access_token),
        //         this.redis.set(this.TOKEN_EXPIRY_KEY, gmailClient.credentials_expiry_date.toString())
        //     ]);
        //     this.logger.debug("Access token cached successfully.");
        // } else {
        //     this.logger.error("Failed to retrieve access token during OAuth callback.");
        // }
    }
} 