import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { GmailInitService } from './initialization/gmail-init.service';
import { createRedisClient } from '../lib/redis/RedisProvider';
import { WinstonLogger } from '../lib/logger/WinstonLogger';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        AuthModule,
    ],
    providers: [
        GmailInitService,
        {
            provide: 'REDIS_CLIENT',
            useFactory: () => createRedisClient()
        },
        {
            provide: 'ILogger',
            useFactory: () => {
                return new WinstonLogger();
            }
        }
    ],
})
export class AppModule { } 