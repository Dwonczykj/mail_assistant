import { WebhookController } from './webhook.controller';
import { EmailServiceManager } from '../../EmailService/EmailServiceManager';
import { GmailService } from '../../EmailService/GmailService';
import { GoogleAuthFactoryService } from '../../lib/auth/services/google-auth-factory.service';
import { ProcessedObjectRepository } from '../../Repository/ProcessedObjectRepository';
import { CategoriserFactory } from '../../Categoriser/CategoriserFactory';
import { DatabaseInitializerService } from '../../data/data-source';
import { GmailListenerService } from '../../EmailService/GmailListener';
import { DesktopGoogleAuthService } from '../../lib/auth/services/desktop-google-auth.service';
import { WebGoogleAuthService } from '../../lib/auth/services/web-google-auth.service';
import { WinstonLogger } from '../../lib/logger';
import { createRedisClient } from '../../lib/redis/RedisProvider';
import { GoogleAuthForWeb } from '../../lib/utils/gmailAuth';
import { FyxerActionRepository } from '../../Repository/FyxerActionRepository';
import { GmailClient } from '../../Repository/GmailClient';
import { MockEmailRepository } from '../../Repository/MockEmailRepository';
import { AuthService } from '../auth/auth.service';
import { GoogleStrategy } from '../auth/strategies/google.strategy';
import { AuthEnvironment } from '../../lib/auth/services/google-auth-factory.service';
import { DynamicModule, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { config } from '../../Config/config';
import { UserCredentialsService } from '../../lib/auth/services/user-credentials.service';
import { User } from '../../data/entity/User';
import { AuthUser } from '../../data/entity/AuthUser';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceUserService } from '../../lib/auth/services/service-user.service';

@Module({})
export class WebhookModule {
    static forRoot(environment: AuthEnvironment): DynamicModule {
        return {
            module: WebhookModule,
            imports: [
                PassportModule.register({ defaultStrategy: 'google' }),
                TypeOrmModule.forFeature([User, AuthUser], DatabaseInitializerService.getDataSource()),
                JwtModule.register({
                    secret: config.jwt.secret,
                    signOptions: { expiresIn: config.jwt.expiresIn },
                }),
            ],
            controllers: [WebhookController],
            providers: [
                AuthService,
                // GmailInitService,
                DatabaseInitializerService,
                GoogleAuthFactoryService,
                WebGoogleAuthService,
                DesktopGoogleAuthService,
                UserCredentialsService,
                ServiceUserService,
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
                GoogleStrategy,

                {
                    provide: 'EmailServiceManager',
                    useClass: EmailServiceManager,
                },
                {
                    provide: 'GmailService',
                    useClass: GmailService,
                },
                {
                    provide: 'ProcessedObjectRepository',
                    useClass: ProcessedObjectRepository,
                },
                GoogleAuthFactoryService,

            ],
        };
    }
}

