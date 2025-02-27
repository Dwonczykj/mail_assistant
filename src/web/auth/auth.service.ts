import { Injectable, Inject } from '@nestjs/common';
import { GmailClient } from '../../Repository/GmailClient';
import { config } from '../../Config/config';
import Redis from 'ioredis';
import { ILogger } from '../../lib/logger/ILogger';
import { redisConfig } from '../../lib/redis/RedisConfig';
import { IGoogleAuth } from '../../lib/utils/IGoogleAuth';
import { AuthEnvironment, GoogleAuthFactoryService } from '../../lib/auth/services/google-auth-factory.service';
import { IGoogleAuthService } from '../../lib/auth/interfaces/google-auth.interface';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
    private googleAuthService: IGoogleAuthService;
    constructor(
        @Inject('REDIS_CLIENT')
        private readonly redis: Redis,
        @Inject('ILogger')
        private readonly logger: ILogger,
        @Inject('GoogleAuthFactoryService')
        private readonly googleAuthFactoryService: GoogleAuthFactoryService,
        @Inject('APP_ENVIRONMENT')
        private readonly environment: AuthEnvironment,
        private readonly jwtService: JwtService,
        // @Inject('IGoogleAuth')
        // private readonly googleAuth: IGoogleAuth,
        // @Inject('GmailClient')
        // private readonly gmailClient: GmailClient,
    ) {
        this.googleAuthService = this.googleAuthFactoryService.getAuthService(this.environment);
    }

    async getGoogleAuthUrl(): Promise<string> {
        // TODO: Add redis cache once working within the google auth service
        const authUrl = this.googleAuthService.getAuthUrl();
        this.logger.debug(`OAuth URL generated: ${authUrl}`);
        return authUrl;
    }

    /**
     * Handles the Google callback and generates a JWT token for the user
     * @param user - The user object from the Google callback
     * @returns A JWT token for the user to make API requests for protected routes
     */
    async generateJwtToken(user: any): Promise<string> {
        try {
            // Extract tokens from the user object
            const { accessToken, refreshToken } = user;

            this.logger.debug(`Received tokens - Access Token: ${accessToken ? 'present' : 'missing'}, Refresh Token: ${refreshToken ? 'present' : 'missing'}`);

            if (!refreshToken) {
                this.logger.warn('No refresh token received. User may need to revoke access and try again.');
            }

            // Use the tokens to authenticate with your service
            await this.googleAuthService.handleOAuthCallback({
                accessToken,
                refreshToken
            });

            // Create a payload for the JWT
            const payload = {
                email: user.email,
                sub: user.id,
                accessToken: user.accessToken,
                refreshToken: user.refreshToken,
            };

            // Generate a JWT token
            const token = this.jwtService.sign(payload, {
                secret: config.jwt.secret,
                expiresIn: config.jwt.expiresIn
            });

            // Return the token
            return token;
        } catch (error) {
            this.logger.error('Failed to handle Google callback', error);
            throw error;
        }
    }

    async validateToken(token: string): Promise<any> {
        try {
            return this.jwtService.verify(token);
        } catch (error) {
            return null;
        }
    }
} 