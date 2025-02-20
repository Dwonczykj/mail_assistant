import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
    // tokenPath: path.join(__dirname, '../../gmail_token.json'),
    // credentialsPath: path.join(__dirname, '../../Google Auth Client Secret.json'),
    gmailScopes: [
        'https://www.googleapis.com/auth/documents.readonly',
        'https://www.googleapis.com/auth/drive.metadata.readonly',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.labels',
        'https://www.googleapis.com/auth/gmail.settings.basic',
        'https://www.googleapis.com/auth/gmail.settings.sharing',
    ],
    daemonTokenPath: path.join(process.cwd(), 'google_auth_token.json'),
    daemonCredentialsPath: path.join(process.cwd(), 'Google Cloud Client Secret for Desktop.json'),
    webAppTokenPath: path.join(process.cwd(), 'google_auth_token_web_app.json'),
    webAppCredentialsPath: path.join(process.cwd(), 'Google Cloud Client Secret for WebApp.json'),
    gmailClientId: process.env.GOOGLE_CLIENT_ID,
    gmailClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    gmailRedirectUri: process.env.GOOGLE_REDIRECT_URI,
    gmailTopic: process.env.GOOGLE_TOPIC,
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback', // http://localhost:3000/auth/google/callback?code=4/0ASVgi3LqZJOmU7GrtxAykTlwUuKVD14UhQeV8TSrFIBmNl-u2iEMyVUiw3VgIiu1ZielNQ&scope=https://www.googleapis.com/auth/gmail.settings.sharing%20https://www.googleapis.com/auth/gmail.settings.basic%20https://www.googleapis.com/auth/gmail.modify
}