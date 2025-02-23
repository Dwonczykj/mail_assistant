import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { authenticate } from '@google-cloud/local-auth';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import Redis from 'ioredis';
import { container } from 'tsyringe';
import process from 'process';
import { config } from '../../Config/config';
import { ILogger } from '../logger/ILogger';
import { openUrl } from './openUrl'; // Added cross-platform URL opener using child_process



const DAEMON_SCOPES = config.google.scopes;
const DAEMON_TOKEN_PATH = config.daemonTokenPath;
const DAEMON_CREDENTIALS_PATH = config.daemonCredentialsPath;

async function loadSavedCredentialsIfExist(): Promise<OAuth2Client | null> {
    try {
        const tokenStr = await fs.promises.readFile(DAEMON_TOKEN_PATH, 'utf-8');
        const token = JSON.parse(tokenStr);
        if (token) {
            let expiry: number | undefined;
            // Prefer `expiry_date` (milliseconds) if it exists; otherwise parse the ISO string from `expiry`
            if (token.expiry_date) {
                expiry = token.expiry_date;
            } else if (token.expiry) {
                expiry = Date.parse(token.expiry);
            }
            if (expiry && Date.now() > expiry - 60000) {
                console.log("Stored token has expired on " + new Date(expiry).toISOString() + " or is about to expire. Ignoring old token and initiating new OAuth flow.");
                // Optionally remove the old token file so it won't be used next time.
                fs.unlinkSync(DAEMON_TOKEN_PATH);
                return null;
            } else {
                return google.auth.fromJSON(token) as OAuth2Client;
            }
        }
        return null;
    } catch (err) {
        return null;
    }
}

/**
 * Gets the clientId and secret from the credentials file and saves the refresh token to the token file.
 * @param client The OAuth2 client to save.
 */
async function saveCredentials(client: OAuth2Client) {
    const content = await fs.promises.readFile(DAEMON_CREDENTIALS_PATH, 'utf-8');
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    await fs.promises.writeFile(DAEMON_TOKEN_PATH, payload);
}

/**
 * Authorizes the client using the local-auth library.
 * @returns The authenticated OAuth2 client.
 */
export async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }
    client = await authenticate({
        scopes: DAEMON_SCOPES,
        keyfilePath: DAEMON_CREDENTIALS_PATH,
    });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}

/**
 * DEPRECATED: included for example demonstration.
 * Lists documents from the user's Google Drive.
 * @param auth The authenticated OAuth2 client.
 */
async function listDocuments(auth: OAuth2Client) {
    const logger: ILogger = container.resolve<ILogger>('ILogger');
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.document'",
        fields: 'files(id, name)',
    });
    const documents = res.data.files;
    if (!documents || documents.length === 0) {
        logger.info('No documents found.');
        return;
    }
    logger.info('Documents:');
    documents.forEach((doc) => {
        logger.info(`${doc.name} (${doc.id})`);
    });
}

/**
 * DEPRECATED: Use the authorize function instead.
 * Retrieves and authorizes an OAuth2 client.
 * If a token is already stored locally, it is used, otherwise an interactive login is performed.
 * @returns {Promise<OAuth2Client>} An OAuth2 client with the required credentials.
 */
async function getAuthenticatedClient({
    sender,
}: {
    sender?: string
}): Promise<OAuth2Client> {
    // Read client credentials from environment variables
    const clientId: string | undefined = config.gmailClientId;
    const clientSecret: string | undefined = config.gmailClientSecret;
    const redirectUri: string = config.gmailRedirectUri || 'http://localhost:3000/oauth2callback';

    if (!clientId || !clientSecret) {
        throw new Error('Gmail client credentials are not set in environment variables.');
    }

    // Create the OAuth2 client
    const oAuth2Client: OAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Check if a previously stored token exists.
    if (fs.existsSync(DAEMON_TOKEN_PATH)) {
        const tokenStr: string = fs.readFileSync(DAEMON_TOKEN_PATH, { encoding: 'utf8' });
        let token: any;
        try {
            token = JSON.parse(tokenStr);
        } catch (e) {
            console.error("Failed to parse token file, proceeding with OAuth flow.");
            token = null;
        }
        if (token) {
            let expiry: number | undefined;
            // Prefer `expiry_date` (milliseconds) if it exists; otherwise parse the ISO string from `expiry`
            if (token.expiry_date) {
                expiry = token.expiry_date;
            } else if (token.expiry) {
                expiry = Date.parse(token.expiry);
            }
            // If expiry is defined and current time is beyond expiry (with a 1-minute buffer), ignore token.
            if (expiry && Date.now() > expiry - 60000) {
                console.log("Stored token has expired or is about to expire. Ignoring old token and initiating new OAuth flow.");
                // Optionally remove the old token file so it won't be used next time.
                fs.unlinkSync(DAEMON_TOKEN_PATH);
            } else {
                oAuth2Client.setCredentials(token);
                return oAuth2Client;
            }
        }
    }

    // Generate the authentication URL.
    const authUrl: string = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: DAEMON_SCOPES,
        state: JSON.stringify({
            sender: "daemon"
        }),
    });
    console.log('Authorize this app by visiting this url:\n', authUrl);

    // Open the URL in the default browser using the cross-platform helper.
    await openUrl(authUrl);

    let code: string;
    if (process.env.IS_DAEMON === 'true') {
        // Daemon mode: Wait for the OAuth code from the Redis channel "googleAuthCode"
        const redisSubscriber = new Redis();
        code = await new Promise<string>((resolve, reject) => {
            redisSubscriber.subscribe('googleAuthCode', (err, count) => {
                if (err) {
                    reject(new Error("Redis subscription error: " + err.message));
                }
            });
            redisSubscriber.on('message', (channel: string, message: string) => {
                if (channel === 'googleAuthCode') {
                    resolve(message);
                    redisSubscriber.unsubscribe('googleAuthCode');
                    redisSubscriber.quit();
                }
            });
            // Optional: set a timeout (e.g. 5 minutes) in case no code is received.
            setTimeout(() => {
                reject(new Error('Timeout waiting for google auth code in daemon.'));
            }, 300000);
        });
    } else {
        // Non-daemon mode: Use interactive readline to prompt the user.
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        code = await new Promise((resolve) => {
            rl.question('Enter the code from that page here: ', (userInput: string) => {
                rl.close();
                resolve(userInput);
            });
        });
    }

    return await _getAuthenticatedClient({
        oAuth2Client,
        code,
    });
}

async function _getAuthenticatedClient({
    oAuth2Client,
    code,
}: {
    oAuth2Client: OAuth2Client,
    code: string,
}): Promise<OAuth2Client> {
    // Exchange the authorization code for tokens.
    const tokenResponse = await oAuth2Client.getToken(code);
    if (!tokenResponse.tokens) {
        throw new Error('Failed to retrieve access token.');
    }
    oAuth2Client.setCredentials(tokenResponse.tokens);

    // Save the token along with any refresh tokens for future use.
    fs.writeFileSync(DAEMON_TOKEN_PATH, JSON.stringify(tokenResponse.tokens));
    console.log('Token stored to', DAEMON_TOKEN_PATH);

    return oAuth2Client;
}