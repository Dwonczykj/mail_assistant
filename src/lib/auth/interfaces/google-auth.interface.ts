import { OAuth2Client } from 'google-auth-library';

export interface GoogleAuthCredentials {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: Date;
}

export interface IGoogleAuthService {
  /**
   * Get the current authentication credentials
   */
  getCredentials(): Promise<GoogleAuthCredentials | null>;

  /**
   * Authenticate with Google
   */
  authenticate(): Promise<OAuth2Client | null>;

  /**
   * Get the OAuth2Client
   */
  get oAuthClient(): OAuth2Client;

  /**
   * Refresh the access token if needed, requires valid credentials on the IGoogleAuthService
   */
  refreshTokenIfNeeded(): Promise<GoogleAuthCredentials>;

  /**
   * Revoke authentication
   */
  revokeAuth(): Promise<void>;

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): Promise<boolean>;

  /**
   * Get the authentication URL
   */
  getAuthUrl(): string;

  /**
   * Handle the OAuth callback
   */
  handleOAuthCallback(whatever: any): Promise<void>;

  /**
   * Save the session token
   */
  saveSessionToken(): Promise<void>;
} 