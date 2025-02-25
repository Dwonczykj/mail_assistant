import { Inject, Injectable, Logger } from '@nestjs/common';
import { IGoogleAuthService, GoogleAuthCredentials } from '../interfaces/google-auth.interface';
import { authenticate } from '@google-cloud/local-auth';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { URL } from 'url';
import { config } from '../../../Config/config';
import { ILogger } from '../../logger/ILogger';

@Injectable()
export class DesktopGoogleAuthService implements IGoogleAuthService {
  // private readonly logger = new Logger(DesktopGoogleAuthService.name);
  private oAuth2Client: OAuth2Client | null = null;
  private credentials: GoogleAuthCredentials | null = null;
  private readonly TOKEN_PATH = config.tokenPath.daemon;
  private readonly SCOPES = config.google.scopes;

  constructor(
    @Inject('ILogger') private readonly logger: ILogger,
  ) {
    try {
      // Load client secrets from file
      const credentialsPath = config.credentialsPath.daemon;
      const content = fs.readFileSync(credentialsPath, 'utf8');
      const credentials = JSON.parse(content);

      // Create OAuth client
      const { client_secret, client_id, redirect_uris } = credentials.installed;
      this.oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]
      );

      // Try to load saved token
      this.loadSavedCredentials();
    } catch (error) {
      this.logger.error('Failed to initialize DesktopGoogleAuthService', error);
    }
  }

  private async loadSavedCredentials(): Promise<OAuth2Client | null> {
    try {
      if (fs.existsSync(this.TOKEN_PATH)) {
        const token = JSON.parse(fs.readFileSync(this.TOKEN_PATH, 'utf8'));
        this.credentials = {
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expiryDate: token.expiry_date ? new Date(token.expiry_date) : undefined
        };
        if (!this.oAuth2Client) {
          throw new Error('No OAuth2Client found');
        }
        else if (!token.access_token && !token.refresh_token && !token.expiry_date) {
          this.logger.error('Invalid token found in loadSavedCredentials', { token });
          return null;
        } else if (token.refresh_token) {
          this.oAuth2Client.setCredentials(token);
          return this.oAuth2Client;
          // return google.auth.fromJSON(token) as OAuth2Client;
        }
      }
    } catch (error) {
      this.logger.error(`Failed to load saved credentials with error: ${error}`);
    }
    return null;
  }

  private saveToken(token: any): void {
    try {
      if (!token.access_token || !token.refresh_token || !token.expiry_date) {
        this.logger.error('Invalid token found in saveToken', { token });
        return;
      }
      fs.writeFileSync(this.TOKEN_PATH, JSON.stringify(token));
      this.logger.info('Token stored to', this.TOKEN_PATH);
    } catch (error) {
      this.logger.error('Failed to save credentials', error);
    }
  }

  /**
   * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
   *
   * @param {OAuth2Client} client
   * @return {Promise<void>}
   */
  async convertCredentialsToTokenFile(client: OAuth2Client) {
    const fs = await import('fs/promises');
    const content = await fs.readFile(config.credentialsPath.daemon, 'utf8');
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
      type: 'authorized_user',
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(this.TOKEN_PATH, payload);
  }


  async getCredentials(): Promise<GoogleAuthCredentials | null> {
    await this.refreshTokenIfNeeded();
    return this.credentials;
  }

  async authenticate(): Promise<OAuth2Client | null> {
    let client = await this.loadSavedCredentials();
    if (client) {
      return client;
    }
    client = await authenticate({
      scopes: this.SCOPES,
      keyfilePath: config.credentialsPath.daemon,
    });
    if (client.credentials) {
      await this.convertCredentialsToTokenFile(client);
    }
    return client;
  }

  get oAuthClient(): OAuth2Client {
    if (!this.oAuth2Client) {
      throw new Error('No OAuth2Client found');
    }
    return this.oAuth2Client;
  }

  getAuthUrl(): string {
    if (!this.oAuth2Client) {
      throw new Error('No OAuth2Client found');
    }
    return this.oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.SCOPES,
      prompt: 'consent',
    });
  }

  async handleOAuthCallback({ code }: { code: string }): Promise<void> {
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
      throw new Error('No credentials found');
    }
    this.credentials = {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token,
      expiryDate: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined
    };
    await this.saveSessionToken();
    // this.logger.info('OAuth2 tokens received and set');
  }

  async saveSessionToken(): Promise<void> {
    const fs = await import('fs/promises');
    const content = await fs.readFile(config.credentialsPath.daemon, 'utf8');
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
    await fs.writeFile(config.tokenPath.daemon, payload);
    this.logger.info('Token stored to', config.tokenPath.daemon);
    // const expiryDate = client.credentials.expiry_date;
    // const accessToken = client.credentials.access_token;
    // const refreshToken = client.credentials.refresh_token;
    // if (accessToken) {
    //     await this.redis.set(this.oauth.token.daemon, accessToken);
    //     await this.redis.set(this.oauth.expiry.daemon, expiryDate?.toString() || "0");
    //     await this.redis.set(this.oauth.refreshToken.daemon, refreshToken || '');
    // }
  }

  async authenticateManuallySpinUpServer(): Promise<GoogleAuthCredentials> {
    return new Promise((resolve, reject) => {
      // Generate auth URL
      if (!this.oAuth2Client) {
        throw new Error('No OAuth2Client found');
      }
      const authUrl = this.oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: this.SCOPES,
        prompt: 'consent', // Force to get refresh token
      });

      console.log('Authorize this app by visiting this url:', authUrl);

      // Create local server to handle the callback
      const server = http.createServer(async (req, res) => {
        try {
          if (!req.url) {
            throw new Error('No URL in request');
          }

          const parsedUrl = new URL(req.url, 'http://localhost');
          const code = parsedUrl.searchParams.get('code');

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('Authentication successful! You can close this window.');

            server.close();

            // Exchange code for tokens
            if (!this.oAuth2Client) {
              throw new Error('No OAuth2Client found');
            }
            const { tokens } = await this.oAuth2Client.getToken(code);
            this.oAuth2Client.setCredentials(tokens);
            if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
              throw new Error('No credentials found');
            }
            this.credentials = {
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined
            };

            this.saveToken(tokens);
            resolve(this.credentials);
          } else {
            throw new Error('No code found in callback URL');
          }
        } catch (error) {
          this.logger.error('Error during authentication callback', error);
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('Authentication failed. Please try again.');
          server.close();
          reject(error);
        }
      });

      // Listen on a random port
      server.listen(0, () => {
        const address = server.address();
        if (address && typeof address !== 'string') {
          this.logger.info(`Local server listening on port ${address.port}`);
        }
      });

      server.on('error', (error) => {
        this.logger.error('Server error during authentication', error);
        reject(error);
      });
    });
  }

  async refreshTokenIfNeeded(): Promise<GoogleAuthCredentials> {
    if (!this.credentials) {
      throw new Error('Not authenticated');
    }

    const now = Date.now();
    const expiryTime = this.credentials.expiryDate?.getTime() || 0;

    // Refresh if token will expire in the next 5 minutes
    if (expiryTime - now < 5 * 60 * 1000) {
      this.logger.info('Refreshing access token');
      if (!this.oAuth2Client) {
        throw new Error('No OAuth2Client found');
      }
      const { credentials } = await this.oAuth2Client.refreshAccessToken();
      this.oAuth2Client.setCredentials(credentials);
      if (!credentials.access_token || !credentials.refresh_token || !credentials.expiry_date) {
        throw new Error('No credentials found');
      }
      this.credentials = {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || this.credentials.refreshToken,
        expiryDate: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined
      };
      this.saveToken(credentials);
    }

    return this.credentials;
  }

  async revokeAuth(): Promise<void> {
    if (this.credentials?.accessToken) {
      try {
        if (!this.oAuth2Client) {
          throw new Error('No OAuth2Client found');
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