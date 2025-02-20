#!/usr/bin/env node
import './container';
import { initServices } from './services';
import { container } from 'tsyringe';
import { config } from './Config/config';

import fs from 'fs';
import path from 'path';
import process from 'process';
import { authenticate } from '@google-cloud/local-auth';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { ILogger } from './lib/logger/ILogger';

const SCOPES = config.gmailScopes;
const TOKEN_PATH = config.daemonTokenPath;
const CREDENTIALS_PATH = config.daemonCredentialsPath;

async function loadSavedCredentialsIfExist(): Promise<OAuth2Client | null> {
    try {
        const tokenStr = await fs.promises.readFile(TOKEN_PATH, 'utf-8');
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
                fs.unlinkSync(TOKEN_PATH);
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

async function saveCredentials(client: OAuth2Client) {
    const content = await fs.promises.readFile(CREDENTIALS_PATH, 'utf-8');
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    await fs.promises.writeFile(TOKEN_PATH, payload);
}

async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }
    client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}

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
 * Entry point for the async daemon Node.js TypeScript application.
 * This script will be run by PM2 as the daemon's entrypoint.
 */

async function main(): Promise<void> {
    console.log("Daemon started");

    // Set up signal handlers for graceful shutdown
    process.on('SIGINT', () => {
        console.log("Received SIGINT, shutting down...");
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log("Received SIGTERM, shutting down...");
        process.exit(0);
    });

    authorize().then(listDocuments).catch(console.error);
}

main().catch((error: any) => {
    console.error("Error in daemon:", error);
    process.exit(1);
});
