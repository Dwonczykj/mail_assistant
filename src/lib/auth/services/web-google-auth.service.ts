import { Inject, Injectable, Logger } from '@nestjs/common';
import { IGoogleAuthService, GoogleAuthCredentials } from '../interfaces/google-auth.interface';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../../../Config/config';
import { ILogger } from '../../logger/ILogger';
import { GoogleWebAuthError } from '../errors/googl-auth-errors';

@Injectable()
export class WebGoogleAuthService implements IGoogleAuthService {
  // private readonly logger = new Logger(WebGoogleAuthService.name);
  private oAuth2Client: OAuth2Client | null = null;
  private credentials: GoogleAuthCredentials | null = null;
  private readonly TOKEN_PATH = config.tokenPath.web;
  private credentialsSaved = false;
  private readonly SCOPES = config.google.scopes;

  constructor(
    @Inject('ILogger') private readonly logger: ILogger,
  ) {
    try {
      // Load client secrets from file
      const credentialsPath = config.credentialsPath.web;
      const content = fs.readFileSync(credentialsPath, 'utf8');
      const credentials = JSON.parse(content);

      // Create OAuth client
      const { client_secret, client_id, redirect_uris } = credentials.web;
      this.oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]
      );

      // Try to load saved token
      this.loadSavedCredentials();
    } catch (error) {
      this.logger.error('Failed to initialize WebGoogleAuthService', error);
    }
  }

  private loadSavedCredentials(): void {
    try {
      if (fs.existsSync(this.TOKEN_PATH)) {
        const token = JSON.parse(fs.readFileSync(this.TOKEN_PATH, 'utf8'));
        this.oAuth2Client?.setCredentials(token);
        this.credentials = {
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expiryDate: token.expiry_date ? new Date(token.expiry_date) : undefined
        };
      }
    } catch (error) {
      this.logger.error('Failed to load saved credentials', error);
    }
  }

  private saveCredentials(token: any): void {
    if (!this.credentialsSaved) {
      this.credentialsSaved = true;
      try {
        fs.writeFileSync(this.TOKEN_PATH, JSON.stringify(token));
        this.logger.info('Token stored to', this.TOKEN_PATH);
      } catch (error) {
        this.logger.error('Failed to save credentials', error);
      }
    }
  }

  async getCredentials(): Promise<GoogleAuthCredentials | null> {
    await this.refreshTokenIfNeeded();
    return this.credentials;
  }

  async authenticate(): Promise<OAuth2Client | null> {
    // For web app, authentication is typically handled by the auth controller
    // This method would be called after the OAuth flow completes
    // TODO: HandleOAuthCallback with code to set the oAuth2Client - BUG atm is that we cant call this on startup as we need the request to redirect the user to google auth to then authenticate the request and save the token credentials.
    this.oAuth2Client ??= new OAuth2Client({
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
      redirectUri: config.googleRedirectUri
    });
    const token = this.oAuth2Client?.credentials;
    if (!token || !token.access_token || !token.expiry_date) {
      throw new GoogleWebAuthError('No token found');
    }
    // ONLY Saves if credentials are not already saved
    this.saveCredentials(token);
    return this.oAuth2Client;
  }

  get oAuthClient(): OAuth2Client {
    if (!this.oAuth2Client) {
      throw new GoogleWebAuthError('No OAuth2Client found');
    }
    return this.oAuth2Client;
  }

  getAuthUrl(): string {
    if (!this.oAuth2Client) {
      throw new GoogleWebAuthError('No OAuth2Client found');
    }
    return this.oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.SCOPES,
      prompt: 'consent',
    });
  }

  async needsTokenRefresh(): Promise<boolean> {
    if (!this.credentials) {
      return true;
    }
    const now = Date.now();
    const expiryTime = this.credentials.expiryDate?.getTime() || 0;
    return expiryTime - now < 5 * 60 * 1000;
  }

  async handleOAuthCallback({ code }: { code: string }): Promise<void> {
    if (code) {
      // Existing code-based flow
      if (!this.oAuth2Client) {
        this.oAuth2Client = new OAuth2Client({
          clientId: config.googleClientId,
          clientSecret: config.googleClientSecret,
          redirectUri: config.googleRedirectUri,
        });
      }

      const { tokens } = await this.oAuth2Client.getToken(code);
      this.oAuth2Client.setCredentials(tokens);
      const credentials = tokens;
      if (!credentials.access_token || !credentials.refresh_token || !credentials.expiry_date) {
        throw new GoogleWebAuthError('No credentials found');
      }
      this.credentials = {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token,
        expiryDate: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined
      };
      await this.saveSessionToken();
    } else {
      throw new GoogleWebAuthError('No code argument provided to handleOAuthCallback');
    }
  }

  async saveSessionToken(): Promise<void> {
    const fs = await import('fs/promises');
    const content = await fs.readFile(config.credentialsPath.web, 'utf8');
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
      type: 'authorized_user',
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: this.credentials?.refreshToken,
      expiry_date: this.credentials?.expiryDate?.toString() || "0",
      access_token: this.credentials?.accessToken
    });
    await fs.writeFile(config.tokenPath.web, payload);
    this.logger.info('Token stored to', config.tokenPath.web);
  }

  async refreshTokenIfNeeded(): Promise<GoogleAuthCredentials> {
    if (!this.credentials) {
      throw new GoogleWebAuthError('Not authenticated');
    }

    const now = Date.now();
    const expiryTime = this.credentials.expiryDate?.getTime() || 0;

    // Refresh if token will expire in the next 5 minutes
    if (expiryTime - now < 5 * 60 * 1000) {
      if (!this.oAuth2Client) {
        throw new GoogleWebAuthError('No OAuth2Client found');
      }
      this.logger.info('Refreshing access token');

      const { credentials } = await this.oAuth2Client.refreshAccessToken();
      this.oAuth2Client.setCredentials(credentials);
      if (!credentials.access_token || !credentials.refresh_token || !credentials.expiry_date) {
        throw new GoogleWebAuthError('No credentials found');
      }
      this.credentials = {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || this.credentials.refreshToken,
        expiryDate: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined
      };
      this.saveCredentials(credentials);
    }

    return this.credentials;
  }

  async revokeAuth(): Promise<void> {
    if (this.credentials?.accessToken) {
      try {
        if (!this.oAuth2Client) {
          throw new GoogleWebAuthError('No OAuth2Client found');
        }
        await this.oAuth2Client.revokeToken(this.credentials.accessToken);
        this.credentials = null;
        if (fs.existsSync(this.TOKEN_PATH)) {
          fs.unlinkSync(this.TOKEN_PATH);
        }
      } catch (error) {
        this.logger.error('Failed to revoke token', error);
        throw error;
      }
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      await this.refreshTokenIfNeeded();
      return !!this.credentials;
    } catch {
      return false;
    }
  }
} 