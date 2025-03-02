import 'reflect-metadata';
import { Module, Global, DynamicModule, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// import { GmailInitService } from './initialization/gmail-init.service';
import { createRedisClient } from './lib/redis/RedisProvider';
import { WinstonLogger } from './lib/logger/WinstonLogger';
import { GoogleAuthForWeb } from './lib/utils/gmailAuth';
import { GmailListenerService } from './EmailService/GmailListener';
import { CategoriserFactory } from './Categoriser/CategoriserFactory';
import { MockEmailRepository } from './Repository/MockEmailRepository';
import { FyxerActionRepository } from './Repository/FyxerActionRepository';
import { DatabaseInitializerService } from './data/data-source';
import { ProcessedObjectRepository } from './Repository/ProcessedObjectRepository';
import { GmailClient } from './Repository/GmailClient';
import { EmailServiceManager } from './EmailService/EmailServiceManager';
import { ILogger } from './lib/logger/ILogger';
import { GmailService } from './EmailService/GmailService';
import { GoogleAuthModule } from './lib/auth/google-auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RequestContextMiddleware } from './lib/context/request-context.middleware';
// import { AuthEnvironment, GoogleAuthFactoryService } from './lib/auth/services/google-auth-factory.service';
import { DesktopGoogleAuthService2, WebGoogleAuthService2 } from './lib/auth/services/desktop-google-auth.service';

import { AuthModule } from './web/auth/auth.module';
import { GmailWebhookController } from './web/controllers/gmail-webhook.controller';
import { ExchangeWebhookController } from './web/controllers/exchange-webhook.controller';
import { PubSubGmailSubscriptionPushProcessor } from './web/controllers/PubSubGmailSubscriptionPushProcessor.service';
import { ExchangeEmailGraphAPIPushProcessor } from './web/controllers/ExchangeEmailGraphAPIPushProcessor.service';
import { ExchangeEmailGraphAPIPubSubPublishProcessor } from './web/controllers/ExchangeEmailGraphAPIPubSubPublishProcessor.service';
import { WebhookModule } from './web/webhook/webhook.module';
import { AppController } from './web/app.controller';
import { AuthEnvironment } from './lib/auth/services/google-auth-factory.service';
import { AuthUser } from './data/entity/AuthUser';
import { User } from './data/entity/User';
import { CurrentUserService } from './lib/auth/services/current-user.service';
import { ServiceUserService } from './lib/auth/services/service-user.service';
import { UserCredentialsService } from './lib/auth/services/user-credentials.service';
import { RequestContext } from './lib/context/request-context';
import { DaemonContextInitializerService } from './lib/context/daemon-context-initializer.service';

@Global()
@Module({})
export class DaemonModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        // No middleware needed for daemon context
        // We'll initialize RequestContext programmatically
    }

    static forRoot(environment: AuthEnvironment): DynamicModule {
        return {
            module: DaemonModule,
            imports: [
                TypeOrmModule.forRootAsync({
                    useFactory: () => (DatabaseInitializerService.getDataSource().options),
                }),
                TypeOrmModule.forFeature([User, AuthUser]),
                // ConfigModule.forRoot({
                //     isGlobal: true,
                // }),
                // AuthModule.forRoot(environment),
                // GoogleAuthModule,
                // WebhookModule.forRoot(environment),
            ],
            controllers: [
                /* No controllers as Daemon */
            ],
            providers: [
                {
                    provide: DataSource,
                    useFactory: () => DatabaseInitializerService.getDataSource(),
                },
                DatabaseInitializerService,
                UserCredentialsService,
                ServiceUserService,
                CurrentUserService,
                WebGoogleAuthService2,
                DesktopGoogleAuthService2,
                RequestContext, // Add RequestContext as a provider
                {
                    provide: 'RequestContext',
                    useClass: RequestContext
                },
                {
                    provide: 'IGoogleAuthService',
                    useExisting: DesktopGoogleAuthService2
                },
                {
                    provide: 'APP_ENVIRONMENT',
                    useValue: environment,
                },
                // GoogleAuthFactoryService,
                // {
                //     provide: 'GoogleAuthFactoryService',
                //     useClass: GoogleAuthFactoryService
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
                },
                {
                    provide: 'PubSubGmailSubscriptionPushProcessor',
                    useClass: PubSubGmailSubscriptionPushProcessor
                },
                {
                    provide: 'ExchangeEmailGraphAPIPushProcessor',
                    useClass: ExchangeEmailGraphAPIPushProcessor
                },
                {
                    provide: 'ExchangeEmailGraphAPIPubSubPublishProcessor',
                    useClass: ExchangeEmailGraphAPIPubSubPublishProcessor
                },
                DaemonContextInitializerService,
            ],
            exports: [
                EmailServiceManager,
                {
                    provide: 'APP_ENVIRONMENT',
                    useValue: environment,
                },
                {
                    provide: 'IGoogleAuthService',
                    useExisting: DesktopGoogleAuthService2
                },
                DataSource,
                RequestContext, // Export RequestContext
            ]
        };
    }
} 