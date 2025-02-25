import { Injectable, Inject } from '@nestjs/common';
import { GmailClient } from '../../Repository/GmailClient';
import { config } from '../../Config/config';
import Redis from 'ioredis';
import { ILogger } from '../../lib/logger/ILogger';
import { redisConfig } from '../../lib/redis/RedisConfig';
import { IGoogleAuth } from '../../lib/utils/IGoogleAuth';
import { AuthEnvironment, GoogleAuthFactoryService } from '../../lib/auth/services/google-auth-factory.service';
import { IGoogleAuthService } from '../../lib/auth/interfaces/google-auth.interface';

@Injectable()
export class AuthService {
    private googleAuthService: IGoogleAuthService;
    constructor(
        @Inject('REDIS_CLIENT')
        private readonly redis: Redis,
        @Inject('ILogger')
        private readonly logger: ILogger,
        @Inject('GoogleAuthFactoryService')
        private readonly googleAuthFactoryService: GoogleAuthFactoryService,
        @Inject('APP_ENVIRONMENT')
        private readonly environment: AuthEnvironment,
        // @Inject('IGoogleAuth')
        // private readonly googleAuth: IGoogleAuth,
        // @Inject('GmailClient')
        // private readonly gmailClient: GmailClient,
    ) {
        this.googleAuthService = this.googleAuthFactoryService.getAuthService(this.environment);
    }

    async getGoogleAuthUrl(): Promise<string> {
        // TODO: Add redis cache once working within the google auth service
        const authUrl = this.googleAuthService.getAuthUrl();
        this.logger.debug(`OAuth URL generated: ${authUrl}`);
        return authUrl;
    }

    async handleGoogleCallback(code: string, sender: string): Promise<void> {
        this.logger.debug(`Handling OAuth callback with code: ${code}`);

        // Handle OAuth callback
        await this.googleAuthService.handleOAuthCallback({ code });

        // // Set up watch after authentication
        // try {
        //     await this.gmailClient.listenForIncomingEmails();
        //     this.logger.info('Successfully set up Gmail watch from handleGoogleCallback AuthService');
        // } catch (error) {
        //     this.logger.error('Failed to set up Gmail watch after authentication', { error });
        //     throw error;
        // }
    }
} 