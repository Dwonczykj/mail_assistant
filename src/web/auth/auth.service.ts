import { Injectable, Logger } from '@nestjs/common';
import { GmailClient } from '../../Repository/GmailClient';
import { config } from '../../Config/config';

@Injectable()
export class AuthService {
    // Added token caching properties
    private accessToken: string | null = null;
    private tokenExpiry: number | null = null;
    private readonly logger = new Logger(AuthService.name);

    async getGoogleAuthUrl(): Promise<string> {
        // Check if a valid token is already cached
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            this.logger.log("Valid access token already exists. Skipping new OAuth configuration.");
            return "ALREADY_AUTHENTICATED"; // Returning this special flag indicates authentication is complete.
        }

        const gmailClient = await GmailClient.getInstance({ sender: "webapi" }); // TODO: BUG: This is not a singleton.
        this.logger.debug("No valid token found. Configuring OAuth...");
        await gmailClient.configureOAuth({
            clientId: config.googleClientId,
            clientSecret: config.googleClientSecret,
            redirectUri: config.googleRedirectUri,
        });
        const authUrl = gmailClient.getAuthUrl();
        this.logger.debug(`OAuth URL generated: ${authUrl}`);
        return authUrl;
    }

    async handleGoogleCallback(code: string, sender: string): Promise<void> {
        const gmailClient = await GmailClient.getInstance({ sender: "webapi" }); // NOTE: We only use webapi callbacks now from requests to Authenticate Google Auth that initiated from the web server.
        this.logger.debug(`Handling OAuth callback with code: ${code}`);
        // Assume handleOAuthCallback returns an object { access_token, expires_in: number }
        const tokenInfo = await gmailClient.handleOAuthCallback(code);
        if (gmailClient.credentials_access_token && gmailClient.credentials_expiry_date) {
            this.accessToken = gmailClient.credentials_access_token;
            this.tokenExpiry = gmailClient.credentials_expiry_date;
            this.logger.log("Access token cached successfully.");
        } else {
            this.logger.error("Failed to retrieve access token during OAuth callback.");
        }
    }
} 