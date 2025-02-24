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