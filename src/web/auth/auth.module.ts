import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import Redis from 'ioredis';
import { ILogger } from '../../lib/logger/ILogger';
import { WinstonLogger as Logger } from '../../lib/logger/WinstonLogger';
import { createRedisClient } from '../../lib/redis/RedisProvider';
@Module({
    controllers: [AuthController],
    providers: [
        AuthService,
        {
            provide: 'REDIS_CLIENT',
            useFactory: () => createRedisClient()
        },
        {
            provide: 'ILogger',
            useFactory: () => {
                return new Logger();
            }
        }
    ],
})
export class AuthModule { } 