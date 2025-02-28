// pubsub-setup.ts
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { OAuth2Client } from 'google-auth-library';

// ----- Configuration -----
const CREDENTIALS_PATH = path.join(__dirname, './Google Cloud Client Secret for WebApp.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
const TOPIC_ID = 'gmail-subscription';
const SUBSCRIPTION_ID = 'gmail-subscription-sub';
const TEST_MESSAGE = 'Hello, World!';
const IAM_MEMBER = 'serviceAccount:gmail-api-push@system.gserviceaccount.com';
const IAM_ROLE = 'roles/pubsub.publisher';

// ----- Helper: Read user input from console -----
async function promptUser(query: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise<string>((resolve) => {
        rl.question(query, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

// ----- Helper: Authenticate using OAuth2 -----
async function authorize(): Promise<OAuth2Client> {
    // Load credentials from file.
    let credentialsRaw: any;
    try {
        const content = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
        credentialsRaw = JSON.parse(content).web;
    } catch (err) {
        throw new Error(`Error loading credentials from ${CREDENTIALS_PATH}: ${err}`);
    }

    const { client_id, client_secret, redirect_uris, project_id } = credentialsRaw;
    const redirectUri = redirect_uris[0];
    const oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

    // Try to load token from disk.
    if (fs.existsSync(TOKEN_PATH)) {
        try {
            const tokenContent = fs.readFileSync(TOKEN_PATH, 'utf8');
            oauth2Client.setCredentials(JSON.parse(tokenContent));
        } catch (err) {
            console.warn('Error reading token file, proceeding to new authentication:', err);
        }
    }

    // If no valid access token, start the auth flow.
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/cloud-platform'],
        });
        console.log('Authorize this app by visiting this URL:', authUrl);
        const code = await promptUser('Enter the code from that page here: ');
        try {
            const { tokens } = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
            console.log('Token stored to', TOKEN_PATH);
        } catch (err) {
            throw new Error(`Error retrieving access token: ${err}`);
        }
    }
    return oauth2Client;
}

// ----- Main Execution -----
async function main() {
    try {
        // Authorize and initialize Pub/Sub API
        const oauth2Client = await authorize();
        const pubsub = google.pubsub('v1');

        // Assume project_id is defined in the credentials file.
        const credentialsRaw = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8')).web;
        const projectId = credentialsRaw.project_id;

        // Format full resource names.
        const topicName = `projects/${projectId}/topics/${TOPIC_ID}`;
        const subscriptionName = `projects/${projectId}/subscriptions/${SUBSCRIPTION_ID}`;

        // ----- Step 1: Create the Topic -----
        console.log(`Creating topic ${TOPIC_ID}...`);
        try {
            const createTopicRes = await pubsub.projects.topics.create({
                name: topicName,
                auth: oauth2Client,
            });
            console.log('Topic created:', createTopicRes.data);
        } catch (err: any) {
            // If topic already exists, skip.
            if (err.response && err.response.data && err.response.data.error && err.response.data.error.message.includes('Already exists')) {
                console.log(`Topic ${TOPIC_ID} already exists. Continuing...`);
            } else {
                throw new Error(`Error creating topic: ${err}`);
            }
        }

        // ----- Step 2: Add IAM Policy Binding to the Topic -----
        console.log(`Adding IAM policy binding to topic ${TOPIC_ID}...`);
        try {
            // Get current IAM policy.
            const getPolicyRes = await pubsub.projects.topics.getIamPolicy({
                resource: topicName,
                auth: oauth2Client,
            });
            const policy = getPolicyRes.data;
            policy.bindings = policy.bindings || [];

            // Check if binding already exists.
            const bindingExists = policy.bindings.some(binding => binding.role === IAM_ROLE && binding.members && binding.members.includes(IAM_MEMBER));
            if (!bindingExists) {
                // Add the binding.
                policy.bindings.push({
                    role: IAM_ROLE,
                    members: [IAM_MEMBER],
                });
                // Set the updated policy.
                const setPolicyRes = await pubsub.projects.topics.setIamPolicy({
                    resource: topicName,
                    requestBody: { policy },
                    auth: oauth2Client,
                });
                console.log('IAM policy updated:', setPolicyRes.data);
            } else {
                console.log('IAM policy binding already exists.');
            }
        } catch (err: any) {
            throw new Error(`Error updating IAM policy: ${err}`);
        }

        // ----- Step 3: Prompt for ngrok URL -----
        const ngrokUrl = await promptUser('What is the ngrok url? (e.g., https://your-ngrok-id.ngrok.io): ');
        if (!ngrokUrl) {
            throw new Error('ngrok URL is required.');
        }
        const pushEndpoint = `${ngrokUrl}/pubsub/webhook`;

        // ----- Step 4: Create the Push Subscription -----
        console.log(`Creating push subscription ${SUBSCRIPTION_ID} with push endpoint ${pushEndpoint}...`);
        try {
            const createSubRes = await pubsub.projects.subscriptions.create({
                name: subscriptionName,
                requestBody: {
                    topic: topicName,
                    pushConfig: { pushEndpoint },
                },
                auth: oauth2Client,
            });
            console.log('Subscription created:', createSubRes.data);
        } catch (err: any) {
            // If subscription already exists, report and continue.
            if (err.response && err.response.data && err.response.data.error && err.response.data.error.message.includes('Already exists')) {
                console.log(`Subscription ${SUBSCRIPTION_ID} already exists. Continuing...`);
            } else {
                throw new Error(`Error creating subscription: ${err}`);
            }
        }

        // ----- Step 5: Publish a Test Message to the Topic -----
        console.log(`Publishing test message to topic ${TOPIC_ID}...`);
        try {
            const encodedMessage = Buffer.from(TEST_MESSAGE).toString('base64');
            const publishRes = await pubsub.projects.topics.publish({
                topic: topicName,
                requestBody: {
                    messages: [
                        { data: encodedMessage }
                    ],
                },
                auth: oauth2Client,
            });
            console.log('Test message published:', publishRes.data);
        } catch (err: any) {
            throw new Error(`Error publishing test message: ${err}`);
        }

        console.log('All operations completed successfully.');
    } catch (err) {
        console.error('An error occurred:', err);
    }
}

main();