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

export interface IGetOAuthClient {
    authenticate(): Promise<OAuth2Client | null>;
    get oAuthClient(): OAuth2Client;
}

export interface IHaveGoogleClient<T> {
    get httpGoogleClient(): T | null;
}