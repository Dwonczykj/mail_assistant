import { Module, DynamicModule } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import Redis from 'ioredis';
import { ILogger } from '../../lib/logger/ILogger';
import { WinstonLogger as Logger, WinstonLogger } from '../../lib/logger/WinstonLogger';
import { createRedisClient } from '../../lib/redis/RedisProvider';
import { GoogleAuthForWeb } from '../../lib/utils/gmailAuth';
import { GmailClient } from '../../Repository/GmailClient';
import { FyxerActionRepository } from '../../Repository/FyxerActionRepository';
import { ProcessedObjectRepository } from '../../Repository/ProcessedObjectRepository';
import { MockEmailRepository } from '../../Repository/MockEmailRepository';
import { DatabaseInitializerService } from '../../data/data-source';
import { GmailListenerService } from '../../EmailService/GmailListener';
import { GmailService } from '../../EmailService/GmailService';
import { EmailServiceManager } from '../../EmailService/EmailServiceManager';
// import { GmailInitService } from '../initialization/gmail-init.service';
import { CategoriserFactory } from '../../Categoriser/CategoriserFactory';
import { AuthEnvironment, GoogleAuthFactoryService } from '../../lib/auth/services/google-auth-factory.service';
import { WebGoogleAuthService } from '../../lib/auth/services/web-google-auth.service';
import { DesktopGoogleAuthService } from '../../lib/auth/services/desktop-google-auth.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { config } from '../../Config/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../data/entity/User';
import { AuthUser } from '../../data/entity/AuthUser';
import { UserCredentialsService } from '../../lib/auth/services/user-credentials.service';
import { DataSource } from 'typeorm';
import { ServiceUserService } from '../../lib/auth/services/service-user.service';

@Module({})
export class AuthModule {
    static forRoot(environment: AuthEnvironment): DynamicModule {
        return {
            module: AuthModule,
            imports: [
                TypeOrmModule.forFeature([User, AuthUser], DatabaseInitializerService.getDataSource()),
                PassportModule.register({ defaultStrategy: 'google' }),
                JwtModule.register({
                    secret: config.jwt.secret,
                    signOptions: { expiresIn: config.jwt.expiresIn },
                }),
            ],
            controllers: [AuthController],
            providers: [
                AuthService,
                GoogleStrategy,
                // GmailInitService,
                DatabaseInitializerService,
                GoogleAuthFactoryService,
                WebGoogleAuthService,
                DesktopGoogleAuthService,
                {
                    provide: 'APP_ENVIRONMENT',
                    useValue: environment
                },
                {
                    provide: 'GoogleAuthFactoryService',
                    useClass: GoogleAuthFactoryService
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
                UserCredentialsService,
                ServiceUserService,
            ],
            exports: [
                AuthService,
                {
                    provide: 'APP_ENVIRONMENT',
                    useValue: environment
                },
                UserCredentialsService,
                ServiceUserService,
            ]
        };
    }
} 