import { OAuth2Client } from 'google-auth-library';
import { User } from '../../../data/entity/User';

export interface GoogleAuthCredentials {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: Date;
}

export interface IGoogleAuthService2 {
  getAuthenticatedClient(): Promise<OAuth2Client | null>;
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
   * Check if the token needs to be refreshed
   */
  needsTokenRefresh(): Promise<boolean>;

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
   * Handle the OAuth callback and its job is:
   * - In the case of **web**, get the credentials from the url callback query and apply the code to the oauth2client to get the credentials out.
   * - In the case of **desktop**, get the credentials from the file system and apply the code to the oauth2client to get the credentials out.
   */
  handleOAuthCallback(whatever: any): Promise<void>;

  /**
   * Save the session token
   */
  saveSessionToken(): Promise<void>;
} 