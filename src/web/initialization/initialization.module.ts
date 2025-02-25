import { Module } from '@nestjs/common';
import { GmailInitService } from './gmail-init.service';
import { WinstonLogger } from '../../lib/logger/WinstonLogger';
import { CategoriserFactory } from '../../Categoriser/CategoriserFactory';
import { DatabaseInitializerService } from '../../data/data-source';
import { EmailServiceManager } from '../../EmailService/EmailServiceManager';
import { GmailListenerService } from '../../EmailService/GmailListener';
import { GmailService } from '../../EmailService/GmailService';
import { createRedisClient } from '../../lib/redis/RedisProvider';
import { GoogleAuthForWeb } from '../../lib/utils/gmailAuth';
import { FyxerActionRepository } from '../../Repository/FyxerActionRepository';
import { GmailClient } from '../../Repository/GmailClient';
import { MockEmailRepository } from '../../Repository/MockEmailRepository';
import { ProcessedObjectRepository } from '../../Repository/ProcessedObjectRepository';
import { DesktopGoogleAuthService } from '../../lib/auth/services/desktop-google-auth.service';
import { AuthEnvironment, GoogleAuthFactoryService } from '../../lib/auth/services/google-auth-factory.service';
import { WebGoogleAuthService } from '../../lib/auth/services/web-google-auth.service';

@Module({
    providers: [
        GmailInitService,
        DatabaseInitializerService,
        WebGoogleAuthService,
        DesktopGoogleAuthService,
        GoogleAuthFactoryService,
        {
            provide: 'GoogleAuthFactoryService',
            useClass: GoogleAuthFactoryService
        },
        // {
        //     provide: 'APP_ENVIRONMENT',
        //     useValue: AuthEnvironment.WEB
        // },
        // {
        //     provide: 'GmailInitService',
        //     useClass: GmailInitService
        // },
        EmailServiceManager,
        {
            provide: 'EmailServiceManager',
            useClass: EmailServiceManager
        },
        {
            provide: 'ILogger',
            useFactory: () => {
                return new WinstonLogger();
            }
        },
        CategoriserFactory,
        {
            provide: 'CategoriserFactory',
            useClass: CategoriserFactory
        },
        {
            provide: 'ICategoriser',
            useFactory: async (categoriserFactory: CategoriserFactory) => categoriserFactory.createCategoriserOpenAI(),
            inject: [CategoriserFactory]
        },
        {
            provide: 'REDIS_CLIENT',
            useFactory: () => createRedisClient()
        },
        {
            provide: 'IGoogleAuth',
            useClass: GoogleAuthForWeb
        },
        GmailClient,
        {
            provide: 'GmailClient',
            useClass: GmailClient
        },
        GmailService,
        {
            provide: 'GmailService',
            useClass: GmailService
        },
        GmailListenerService,
        {
            provide: 'GmailListenerService',
            useClass: GmailListenerService
        },
        {
            provide: 'IMockEmailRepository',
            useClass: MockEmailRepository
        },
        {
            provide: 'ProcessedObjectRepository',
            useClass: ProcessedObjectRepository
        },
        {
            provide: 'IFyxerActionRepository',
            useClass: FyxerActionRepository
        }
    ],
})
export class InitializationModule { } 