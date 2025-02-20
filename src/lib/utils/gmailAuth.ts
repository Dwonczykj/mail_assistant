import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { openUrl } from './openUrl'; // Added cross-platform URL opener using child_process
import { config } from '../../Config/config';
import Redis from 'ioredis';
// Define the scopes your application needs.
// For example, here we request permission to modify Gmail.
const SCOPES: string[] = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.settings.basic',
    'https://www.googleapis.com/auth/gmail.settings.sharing'
];
const TOKEN_PATH: string = config.tokenPath;

/**
 * Retrieves and authorizes an OAuth2 client.
 * If a token is already stored locally, it is used, otherwise an interactive login is performed.
 * @returns {Promise<OAuth2Client>} An OAuth2 client with the required credentials.
 */
export async function getAuthenticatedClient({
    sender,
    preExistingCode = null,
}: {
    preExistingCode?: string | null,
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

    if (preExistingCode) {
        return await _getAuthenticatedClient({
            oAuth2Client,
            code: preExistingCode,
        });
    }

    // Check if a previously stored token exists.
    if (fs.existsSync(TOKEN_PATH)) {
        const tokenStr: string = fs.readFileSync(TOKEN_PATH, { encoding: 'utf8' });
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
                fs.unlinkSync(TOKEN_PATH);
            } else {
                oAuth2Client.setCredentials(token);
                return oAuth2Client;
            }
        }
    }

    // Generate the authentication URL.
    const authUrl: string = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
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
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenResponse.tokens));
    console.log('Token stored to', TOKEN_PATH);

    return oAuth2Client;
}