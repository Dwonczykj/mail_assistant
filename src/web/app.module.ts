import 'reflect-metadata';
import { Module, DynamicModule } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { GmailInitService } from './initialization/gmail-init.service';
import { createRedisClient } from '../lib/redis/RedisProvider';
import { WinstonLogger } from '../lib/logger/WinstonLogger';
import { GmailWebhookController } from './controllers/gmail-webhook.controller';
import { GoogleAuthForWeb } from '../lib/utils/gmailAuth';
import { GmailListenerService } from '../EmailService/GmailListener';
import { CategoriserFactory } from '../Categoriser/CategoriserFactory';
import { MockEmailRepository } from '../Repository/MockEmailRepository';
import { FyxerActionRepository } from '../Repository/FyxerActionRepository';
import { DatabaseInitializerService } from '../data/data-source';
import { ProcessedObjectRepository } from '../Repository/ProcessedObjectRepository';
import { GmailClient } from '../Repository/GmailClient';
import { EmailServiceManager } from '../EmailService/EmailServiceManager';
import { ILogger } from '../lib/logger/ILogger';
import { GmailService } from '../EmailService/GmailService';
import { InitializationModule } from './initialization/initialization.module';
import { GoogleAuthModule } from '../lib/auth/google-auth.module';
import { AuthEnvironment, GoogleAuthFactoryService } from '../lib/auth/services/google-auth-factory.service';
import { WebGoogleAuthService } from '../lib/auth/services/web-google-auth.service';
import { DesktopGoogleAuthService } from '../lib/auth/services/desktop-google-auth.service';

@Module({})
export class AppModule {
    static forRoot(environment: AuthEnvironment): DynamicModule {
        return {
            module: AppModule,
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                }),
                AuthModule.forRoot(environment),
                // InitializationModule,
                GoogleAuthModule,
            ],
            providers: [
                // GmailInitService,
                DatabaseInitializerService,
                WebGoogleAuthService,
                DesktopGoogleAuthService,
                {
                    provide: 'APP_ENVIRONMENT',
                    useValue: environment,
                },
                GoogleAuthFactoryService,
                {
                    provide: 'GoogleAuthFactoryService',
                    useClass: GoogleAuthFactoryService
                },
                {
                    provide: 'GmailInitService',
                    useClass: GmailInitService
                },
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
                },
            ],
            controllers: [
                GmailWebhookController
            ],
            exports: [
                EmailServiceManager,
                {
                    provide: 'APP_ENVIRONMENT',
                    useValue: environment,
                },
            ]
        };
    }
} 