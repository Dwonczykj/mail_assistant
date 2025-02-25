import { Module } from '@nestjs/common';
import { WebGoogleAuthService } from './services/web-google-auth.service';
import { DesktopGoogleAuthService } from './services/desktop-google-auth.service';
import { GoogleAuthFactoryService } from './services/google-auth-factory.service';
import { WinstonLogger } from '../logger/WinstonLogger';

@Module({
    providers: [
        WebGoogleAuthService,
        DesktopGoogleAuthService,
        GoogleAuthFactoryService,
        {
            provide: 'ILogger',
            useValue: new WinstonLogger(),
        },
    ],
    exports: [
        GoogleAuthFactoryService,
    ],
})
export class GoogleAuthModule { } 