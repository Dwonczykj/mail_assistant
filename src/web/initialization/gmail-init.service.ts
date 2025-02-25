import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { GmailClient } from '../../Repository/GmailClient';
import { config } from '../../Config/config';
import Redis from 'ioredis';
import { ILogger } from '../../lib/logger/ILogger';
import { redisConfig } from '../../lib/redis/RedisConfig';
import { OAuth2Client } from 'google-auth-library';
import { IGoogleAuth } from '../../lib/utils/IGoogleAuth';
import { google } from 'googleapis';
@Injectable()
export class GmailInitService implements OnModuleInit {
    constructor(
        @Inject('REDIS_CLIENT')
        private readonly redis: Redis,
        @Inject('ILogger')
        private readonly logger: ILogger,
        @Inject('GmailClient')
        private readonly gmailClient: GmailClient,
    ) { }

    async onModuleInit() {
        await this.initializeGoogleClient();
    }

    async initializeGoogleClient(): Promise<GmailClient> {
        try {
            this.logger.info('Gmail client initialized during bootstrap');
            return this.gmailClient;
        } catch (error) {
            this.logger.error('Failed to initialize Gmail client during bootstrap:', { error });
            throw error;
        }
    }
} 