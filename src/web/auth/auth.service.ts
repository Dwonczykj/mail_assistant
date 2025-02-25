import { Injectable, Inject } from '@nestjs/common';
import { GmailClient } from '../../Repository/GmailClient';
import { config } from '../../Config/config';
import Redis from 'ioredis';
import { ILogger } from '../../lib/logger/ILogger';
import { redisConfig } from '../../lib/redis/RedisConfig';
import { IGoogleAuth } from '../../lib/utils/IGoogleAuth';

@Injectable()
export class AuthService {
    constructor(
        @Inject('REDIS_CLIENT')
        private readonly redis: Redis,
        @Inject('ILogger')
        private readonly logger: ILogger,
        @Inject('IGoogleAuth')
        private readonly googleAuth: IGoogleAuth,
        @Inject('GmailClient')
        private readonly gmailClient: GmailClient,
    ) { }

    async getGoogleAuthUrl(): Promise<string> {
        const valid = await this.googleAuth.redisCacheAuthValid();
        if (valid) {
            this.logger.debug("Valid access token already exists. Skipping new OAuth configuration.");
            return "ALREADY_AUTHENTICATED"; // Returning this special flag indicates authentication is complete.
        }

        const authUrl = this.googleAuth.getAuthUrl();
        this.logger.debug(`OAuth URL generated: ${authUrl}`);
        return authUrl;
    }

    async handleGoogleCallback(code: string, sender: string): Promise<void> {
        this.logger.debug(`Handling OAuth callback with code: ${code}`);

        // Handle OAuth callback
        await this.googleAuth.handleOAuthCallback({ code });

        // Set up watch after authentication
        try {
            await this.gmailClient.listenForIncomingEmails();
            this.logger.info('Successfully set up Gmail watch from handleGoogleCallback AuthService');
        } catch (error) {
            this.logger.error('Failed to set up Gmail watch after authentication', { error });
            throw error;
        }
    }
} 