import { DynamicModule, Module } from '@nestjs/common';
import { DesktopGoogleAuthService2, WebGoogleAuthService2 } from './services/desktop-google-auth.service';
// import { GoogleAuthFactoryService } from './services/google-auth-factory.service';
import { WinstonLogger } from '../logger/WinstonLogger';
import { AppModule } from '../../web/app.module';
import { DaemonModule } from '../../daemon.module';
import { AuthEnvironment } from './services/google-auth-factory.service';

@Module({})
export class GoogleAuthModule {
    static forRoot(environment: AuthEnvironment): DynamicModule {
        return {
            module: GoogleAuthModule,
            imports: environment === AuthEnvironment.WEB ? [
                AppModule.forRoot(environment)
            ] : [
                DaemonModule.forRoot(environment)
            ],
            providers: [
                WebGoogleAuthService2,
                DesktopGoogleAuthService2,
                // GoogleAuthFactoryService,
                {
                    provide: 'ILogger',
                    useValue: new WinstonLogger(),
                },
            ],
            exports: [
                // GoogleAuthFactoryService,
            ],
        };
    }
 } 