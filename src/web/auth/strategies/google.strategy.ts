import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, StrategyOptions } from 'passport-google-oauth20';
import { config } from '../../../Config/config';

// Extend the strategy options to include Google-specific parameters
interface GoogleStrategyOptions extends StrategyOptions {
    accessType?: string;
    prompt?: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor() {
        // Cast the options to any to bypass type checking
        super({
            clientID: config.googleClientId,
            clientSecret: config.googleClientSecret,
            callbackURL: config.googleRedirectUri,
            scope: ['email', 'profile', ...config.google.scopes],
            accessType: 'offline',
            prompt: 'consent',
        } as GoogleStrategyOptions);
    }

    async validate(
        accessToken: string,
        refreshToken: string,
        profile: any,
        done: VerifyCallback,
    ): Promise<any> {
        const { name, emails, photos } = profile;
        const user = {
            email: emails[0].value,
            firstName: name.givenName,
            lastName: name.familyName,
            picture: photos[0].value,
            accessToken,
            refreshToken,
        };

        done(null, user);
    }
} 