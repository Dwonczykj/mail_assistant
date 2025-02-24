import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { GmailClient } from '../../Repository/GmailClient';
import { config } from '../../Config/config';
import Redis from 'ioredis';
import { ILogger } from '../../lib/logger/ILogger';

@Injectable()
export class GmailInitService implements OnModuleInit {
    constructor(
        @Inject('REDIS_CLIENT')
        private readonly redis: Redis,
        @Inject('ILogger')
        private readonly logger: ILogger
    ) { }

    async onModuleInit() {
        await this.initializeGmailClient();
    }

    private async initializeGmailClient(): Promise<void> {
        try {
            const [token, expiry] = await Promise.all([
                this.redis.get('gmail:oauth:token'),
                this.redis.get('gmail:oauth:expiry')
            ]);

            // Check if token exists and is not expired
            if (token && expiry && Date.now() < parseInt(expiry)) {
                this.logger.info('Valid Gmail token found in Redis cache');
                return;
            }

            // Initialize new Gmail client and configure OAuth
            const gmailClient = await GmailClient.getTemporaryInstance({ sender: "webapp" });
            this.logger.info('Configuring Gmail OAuth for webapp initialization...');

            await gmailClient.configureOAuth({
                clientId: config.googleClientId,
                clientSecret: config.googleClientSecret,
                redirectUri: config.googleRedirectUri,
            });

            this.logger.info('Gmail client initialized during bootstrap');
        } catch (error) {
            this.logger.error('Failed to initialize Gmail client during bootstrap:', { error });
            // Don't throw error - allow application to start even if Gmail init fails
        }
    }
} 