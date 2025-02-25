import 'reflect-metadata';
import { Module } from '@nestjs/common';
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

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        AuthModule,
    ],
    providers: [
        EmailServiceManager,
        GmailInitService,
        GmailListenerService,
        DatabaseInitializerService,
        CategoriserFactory,
        {
            provide: 'ILogger',
            useFactory: () => {
                return new WinstonLogger();
            }
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
        {
            provide: 'GmailClient',
            useClass: GmailClient
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
    controllers: [
        GmailWebhookController
    ],
    exports: [
        EmailServiceManager
    ]
})
export class AppModule { } 