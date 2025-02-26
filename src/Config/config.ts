import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const webApiPort = process.env.WEB_API_PORT || 3000;
const webApiBaseUrl = process.env.API_BASE_URL || `http://localhost:${webApiPort}`;

const apiKeys = {
    openai: process.env.OPENAI_API_KEY || '',
    gemini: process.env.GEMINI_API_KEY || '',
    vertexaiWebCreds: process.env.GOOGLE_VERTEX_AI_WEB_CREDENTIALS_JSON || { "type": "service_account", "project_id": "YOUR_PROJECT-12345", },
    anthropic: process.env.ANTHROPIC_API_KEY || '',
    openrouter: process.env.OPENROUTER_API_KEY || '',
    langchain: process.env.LANGCHAIN_API_KEY || '',
};

const langchain = {
    endpoint: process.env.LANGCHAIN_ENDPOINT || '',
    project: process.env.LANGCHAIN_PROJECT || '',
    tracingV2: process.env.LANGCHAIN_TRACING_V2 || '',
    apiKey: apiKeys.langchain,
};

const openrouter = {
    apiKey: apiKeys.openrouter,
    apiUrl: process.env.OPENROUTER_API_URL || '',
};

export interface PubSubConfig {
    projectId: string;
    topicName: string;
    subscriptionName: string;
}

export const gmailPubSubConfig: PubSubConfig = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
    topicName: process.env.GOOGLE_TOPIC || `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-notifications`,
    subscriptionName: process.env.GOOGLE_SUBSCRIPTION || `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/subscriptions/gmail-notifications-sub`
};
export const exchangePubSubConfig: PubSubConfig = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
    topicName: process.env.GOOGLE_EXCHANGE_TOPIC || `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/exchange-notifications`,
    subscriptionName: process.env.GOOGLE_EXCHANGE_SUBSCRIPTION || `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/subscriptions/exchange-notifications-sub`
};

const google = {
    pubSubConfig: gmailPubSubConfig,
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `http://localhost:${webApiPort}/auth/google/callback`, // http://localhost:3000/auth/google/callback?code=4/0ASVgi3LqZJOmU7GrtxAykTlwUuKVD14UhQeV8TSrFIBmNl-u2iEMyVUiw3VgIiu1ZielNQ&scope=https://www.googleapis.com/auth/gmail.settings.sharing%20https://www.googleapis.com/auth/gmail.settings.basic%20https://www.googleapis.com/auth/gmail.modify
    scopes: [
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
    gmailTopic: process.env.GOOGLE_TOPIC || '',
    exchangeTopic: process.env.GOOGLE_EXCHANGE_TOPIC || '',
    gmailSubscription: process.env.GOOGLE_SUBSCRIPTION || '',
    googleProjectId: process.env.GOOGLE_PROJECT_ID || '',
    llmModelsNames: [
        "gemini-pro",
        "gemini-pro-vision",
        "gemini-1.5-flash",
        "gemini-1.5-flex",
        "gemini-1.5-pro",


    ]
}

const exchange = {
    pubSubConfig: exchangePubSubConfig,
    subscriptionUrl: process.env.EXCHANGE_SUBSCRIPTION_URL || '',
}

export const config = {
    apiKeys,
    langchain,
    openrouter,
    google,
    exchange,
    tokenPath: {
        daemon: path.join(process.cwd(), 'google_auth_daemon_token.json'),
        web: path.join(process.cwd(), 'google_auth_web_token.json'),
    },
    credentialsPath: {
        daemon: path.join(process.cwd(), 'Google Cloud Client Secret for Desktop.json'),
        web: path.join(process.cwd(), 'Google Cloud Client Secret for WebApp.json'),
    },
    gmailClientId: google.clientId,
    gmailClientSecret: google.clientSecret,
    gmailRedirectUri: google.redirectUri,
    gmailTopic: google.gmailTopic,
    googleClientId: google.clientId,
    googleClientSecret: google.clientSecret,
    googleRedirectUri: google.redirectUri,
}