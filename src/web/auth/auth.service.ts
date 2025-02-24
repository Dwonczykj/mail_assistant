import { Injectable, Inject } from '@nestjs/common';
import { GmailClient } from '../../Repository/GmailClient';
import { config } from '../../Config/config';
import Redis from 'ioredis';
import { ILogger } from '../../lib/logger/ILogger';
import { redisConfig } from '../../lib/redis/RedisConfig';
import { IGmailAuth as IGoogleAuth } from '../../lib/utils/IGmailAuth';

@Injectable()
export class AuthService {
    constructor(
        @Inject('REDIS_CLIENT')
        private readonly redis: Redis,
        @Inject('ILogger')
        private readonly logger: ILogger,
        @Inject('IGoogleAuth')
        private readonly googleAuth: IGoogleAuth
    ) { }

    async getGoogleAuthUrl(): Promise<string> {
        const [token, expiry] = await Promise.all([
            this.redis.get(redisConfig.keys.gmail.web.oauth.token),
            this.redis.get(redisConfig.keys.gmail.web.oauth.expiry)
        ]);
        // Check if a valid token is already cached
        if (token && expiry && Date.now() < parseInt(expiry)) {
            this.logger.debug("Valid access token already exists. Skipping new OAuth configuration.");
            return "ALREADY_AUTHENTICATED"; // Returning this special flag indicates authentication is complete.
        }

        const gmailClient = await GmailClient.getTemporaryInstance({ authProvider: this.googleAuth });
        const authUrl = this.googleAuth.getAuthUrl();
        this.logger.debug(`OAuth URL generated: ${authUrl}`);
        return authUrl;
    }

    async handleGoogleCallback(code: string, sender: string): Promise<void> {
        this.logger.debug(`Handling OAuth callback with code: ${code}`);
        // Assume handleOAuthCallback returns an object { access_token, expires_in: number }
        await this.googleAuth.handleOAuthCallback({ code, authProvider: this.googleAuth });
    }
} 