import { Injectable, Inject } from '@nestjs/common';
import { config } from '../../Config/config';
import Redis from 'ioredis';
import { ILogger } from '../../lib/logger/ILogger';
// import { AuthEnvironment, GoogleAuthFactoryService } from '../../lib/auth/services/google-auth-factory.service';
import { IGoogleAuthService2 } from '../../lib/auth/interfaces/google-auth.interface';
import { JwtService } from '@nestjs/jwt';
import { google } from 'googleapis';
import { Credentials, OAuth2Client } from 'google-auth-library';
@Injectable()
export class AuthService {
    constructor(
        @Inject('REDIS_CLIENT') private readonly redis: Redis,
        @Inject('ILogger') private readonly logger: ILogger,
        private readonly jwtService: JwtService,
        @Inject('IGoogleAuthService') private readonly googleAuthService: IGoogleAuthService2,
    ) {}

    async dummyAuthNoAuthGuard({ code, scope, prompt }: { code: string, scope: string | null, prompt: string | null }): Promise<void> {
        // Set up the OAuth2 client.
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
        const { tokens } = await this.dummyParseOneTimeCode({ code, oauth2Client });
        await this.dummySetTokenCredentialsToOAuthClient({ tokens, oauth2Client });
        await this.setupGmailPushNotifications({ auth: oauth2Client });
    }

    async dummyAuthForUseAfterAuthGuard({ tokens }: { tokens: Credentials }): Promise<void> {
        // Set up the OAuth2 client.
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
        await this.dummySetTokenCredentialsToOAuthClient({ tokens, oauth2Client });
        await this.setupGmailPushNotifications({ auth: oauth2Client });
    }

    private async dummyParseOneTimeCode({ code, oauth2Client }: { code: string, oauth2Client: OAuth2Client }): Promise<{ tokens: Credentials }> {
        if (!code) {
            throw new Error('Authorization code not found in callback URL.');
        } else if (!oauth2Client) {
            throw new Error('OAuth2 client not found.');
        }
        const { tokens } = await oauth2Client.getToken(code);
        return { tokens };
    }

    private async dummySetTokenCredentialsToOAuthClient({ tokens, oauth2Client }: { tokens: Credentials, oauth2Client: OAuth2Client }) {
        await oauth2Client.setCredentials(tokens);
        this.logger.info('Authenticated. Tokens:', tokens);
    }

    private async setupGmailPushNotifications({ auth }: { auth: OAuth2Client }) {
        const gmail = google.gmail({ version: 'v1', auth });
        try {
            this.logger.debug(`Setting up push notifications from user's gmail to pub/sub topic: ${config.google.pubSubConfig.topicName}`);
            const response = await gmail.users.watch({
                userId: 'me',
                requestBody: {
                    // You can limit notifications to specific labels; here we're watching the INBOX.
                    labelIds: ['INBOX'],
                    // The full name of your Pub/Sub topic.
                    topicName: config.google.pubSubConfig.topicName
                }
            });
            this.logger.debug('Push notifications setup successfully:', { response: `${response.data}` });
        } catch (error) {
            this.logger.error('Error setting up push notifications:', { error: `Error: ${error}` });
        }
    }

    /**
     * Handles the Google callback and generates a JWT token for the user
     * @param user - The user object from the Google callback
     * @returns A JWT token for the user to make API requests for protected routes
     */
    async generateJwtToken({ user, accessToken }: { user: any, accessToken?: string }): Promise<string> {
        try {
            // Extract tokens from the user object
            this.logger.debug(`AuthService.generateJwtToken: Received user object: ${JSON.stringify(user)}`);
            let payload: {
                email: string,
                sub: string,
                accessToken?: string,
                refreshToken?: string,
            };
            if (!user) {
                this.logger.error('No user object received from Google callback');
                throw new Error('No user object received from Google callback');
            } else if (!user.accessToken) {
                this.logger.warn('No access token received from Google callback');
                payload = {
                    email: user.email,
                    sub: user.id,
                };
            } else if (!user.refreshToken) {
                this.logger.warn('No refresh token received from Google callback');
                payload = {
                    email: user.email,
                    sub: user.id,
                };
            } else {
                payload = {
                    email: user.email,
                    sub: user.id,
                    accessToken: user.accessToken,
                    refreshToken: user.refreshToken,
                };
            }

            this.logger.debug(`Received tokens - Access Token: ${payload.accessToken ? 'present' : 'missing'}, Refresh Token: ${payload.refreshToken ? 'present' : 'missing'}`);
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