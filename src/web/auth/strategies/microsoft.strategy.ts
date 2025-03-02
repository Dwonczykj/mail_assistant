import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, StrategyOptions } from 'passport-google-oauth20';
import { config } from '../../../Config/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../data/entity/User';
import { AuthUser, AuthProvider } from '../../../data/entity/AuthUser';

// Extend the strategy options to include Google-specific parameters
interface MicrosoftStrategyOptions extends StrategyOptions {
    accessType?: string;
    prompt?: string;
}

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(AuthUser)
        private authUserRepository: Repository<AuthUser>,
    ) {
        // Cast the options to any to bypass type checking
        super({
            clientID: config.exchange.credentials.clientId,
            clientSecret: config.exchange.credentials.clientSecret,
            callbackURL: config.exchange.credentials.redirectUri,
            scope: ['email', 'profile', ...config.exchange.scopes],
            accessType: 'offline',
            prompt: 'consent',
        } as MicrosoftStrategyOptions);
    }

    async validate(
        accessToken: string,
        refreshToken: string,
        profile: any,
        done: VerifyCallback,
    ): Promise<any> {
        const { name, emails, photos, id: providerId } = profile;
        const email = emails[0].value;

        try {
            // Find existing user or create a new one
            let user = await this.userRepository.findOne({ where: { email } });

            if (!user) {
                user = this.userRepository.create({
                    email,
                    firstName: name.givenName,
                    lastName: name.familyName,
                    picture: photos[0].value,
                    username: email.split('@')[0], // Default username from email
                });
                await this.userRepository.save(user);
            }

            // Find existing auth record or create a new one
            let authUser = await this.authUserRepository.findOne({
                where: {
                    userId: user.id,
                    provider: AuthProvider.MICROSOFT,
                }
            });

            if (authUser) {
                // Update existing auth record
                authUser.accessToken = accessToken;
                authUser.refreshToken = refreshToken || authUser.refreshToken; // Keep old refresh token if new one is not provided
                authUser.expiryDate = new Date(Date.now() + 3600 * 1000); // 1 hour from now
            } else {
                // Create new auth record
                authUser = this.authUserRepository.create({
                    provider: AuthProvider.GOOGLE,
                    providerId,
                    accessToken,
                    refreshToken,
                    expiryDate: new Date(Date.now() + 3600 * 1000), // 1 hour from now
                    userId: user.id,
                });
            }

            await this.authUserRepository.save(authUser);

            // Return user with auth info, Google Strategy can only return a user object
            const microsoftStratReturnUser = {
                ...user,
                authUser,
                accessToken,
                refreshToken,
            };

            done(null, microsoftStratReturnUser);
        } catch (error) {
            done(error, false);
        }
    }
} 