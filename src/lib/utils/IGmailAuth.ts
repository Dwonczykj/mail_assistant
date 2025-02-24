import { OAuth2Client } from "google-auth-library";

export interface IGmailAuth {
    initializeGoogleClient(): Promise<OAuth2Client>;
    handleOAuthCallback({ code, authProvider, }: { code: string, authProvider: IGmailAuth, }): Promise<void>;
    getAuthUrl(): string;
}