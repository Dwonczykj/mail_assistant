import { OAuth2Client, Credentials } from "google-auth-library";

export interface IGoogleAuth {
    initializeGoogleClient(): Promise<OAuth2Client>;
    handleOAuthCallback({ code }: {
        code: string
    }): Promise<void>;
    getAuthUrl(): string;
    redisCacheAuthValid(): Promise<boolean>;
    getCredentials(): Promise<Credentials | null>;
    refreshToken(): Promise<void>;
}

export interface IReceiveOAuthClient {
    authenticate({ oAuthClient }: { oAuthClient: OAuth2Client }): Promise<void>;
    get authenticated(): Promise<boolean>;
    needsTokenRefresh(): Promise<boolean>;
}

export interface IGetOAuthClient {
    authenticate(): Promise<OAuth2Client | null>;
    get oAuthClient(): OAuth2Client;
}

export interface IHaveGoogleClient<T> extends IReceiveOAuthClient {
    get httpGoogleClient(): T | null;
}