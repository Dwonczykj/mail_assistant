import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { GmailInitService } from './initialization/gmail-init.service';
import { createRedisClient } from '../lib/redis/RedisProvider';
import { WinstonLogger } from '../lib/logger/WinstonLogger';
import { GmailWebhookController } from './controllers/gmail-webhook.controller';
import { GoogleAuthForWeb } from '../lib/utils/gmailAuth';
import { GmailListenerService } from '../EmailService/GmailListener';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        AuthModule,
    ],
    providers: [
        GmailInitService,
        GmailListenerService,
        {
            provide: 'REDIS_CLIENT',
            useFactory: () => createRedisClient()
        },
        {
            provide: 'ILogger',
            useFactory: () => {
                return new WinstonLogger();
            }
        },
        {
            provide: 'IGoogleAuth',
            useClass: GoogleAuthForWeb
        }
    ],
    controllers: [
        GmailWebhookController
    ],
})
export class AppModule { } 