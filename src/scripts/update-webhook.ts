import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import dotenv from 'dotenv';
import { config } from '../Config/config';

const execAsync = promisify(exec);

dotenv.config();

async function getNgrokUrl(): Promise<string> {
    try {
        // Ngrok exposes a local API that shows active tunnels
        const response = await axios.get('http://localhost:4040/api/tunnels');
        const tunnel = response.data.tunnels.find((t: any) => t.proto === 'https');
        if (!tunnel) {
            throw new Error('No HTTPS tunnel found');
        }
        return tunnel.public_url;
    } catch (error) {
        console.error('Failed to get ngrok URL. Make sure ngrok is running.');
        console.log('Please start ngrok first with: ngrok http 3000');
        process.exit(1);
    }
}

async function executeCommand(command: string): Promise<void> {
    try {
        const { stdout, stderr } = await execAsync(command);

        // Log any output
        if (stdout) console.log(stdout);

        // Check for specific success messages
        if (stderr) {
            if (stderr.includes('Updated IAM policy') ||
                stderr.includes('already exists')) {
                console.log(stderr); // This is actually a success message
                return;
            }
            // Real errors
            console.error('Command error:', stderr);
            throw new Error(stderr);
        }
    } catch (error: any) {
        // Handle resource not found
        if (error.message.includes('NOT_FOUND')) {
            throw error;
        }
        // Handle resource already exists
        if (error.message.includes('ALREADY_EXISTS')) {
            console.log('Resource already exists, continuing...');
            return;
        }
        // Handle other errors
        if (!error.message.includes('already exists') &&
            !error.message.includes('Updated IAM policy')) {
            throw error;
        }
    }
}

async function updateWebhook({ topicName, subscriptionName, webhookSubPath }: { topicName: string, subscriptionName: string, webhookSubPath: string }): Promise<void> {
    try {
        const ngrokUrl = await getNgrokUrl();
        console.log(`Found ngrok URL: ${ngrokUrl}`);

        // Create topic if it doesn't exist
        await executeCommand(`gcloud pubsub topics create ${topicName.split('/').pop()}`);

        // TODO: Grant Exchange Permissin for Exchange ACCOUNT name intead of gmail-api-push@system.gserviceaccount.com
        // Grant Gmail permission
        await executeCommand(
            `gcloud pubsub topics add-iam-policy-binding ${topicName.split('/').pop()} \
            --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
            --role="roles/pubsub.publisher"`
        );

        // Try to create subscription first
        try {
            await executeCommand(
                `gcloud pubsub subscriptions create ${subscriptionName.split('/').pop()} \
                --topic=${topicName.split('/').pop()} \
                --push-endpoint=${ngrokUrl}/webhooks/${webhookSubPath}`
            );
        } catch (error: any) {
            if (error.message.startsWith('Created subscription')) {
                console.log('Subscription already exists, continuing...');
            }
            else if (error.message.includes('NOT_FOUND') || error.message.includes('ALREADY_EXISTS')) { // TODO: Check if error might actually contain something like "Subscription already exists" in CAPS
                // If creation fails, try updating
                await executeCommand(
                    `gcloud pubsub subscriptions update ${subscriptionName.split('/').pop()} \
                    --push-endpoint=${ngrokUrl}/webhooks/${webhookSubPath}`
                );
            } else {
                throw error;
            }
        }

        console.log(`Successfully configured Pub/Sub webhook for ${topicName}`);
    } catch (error) {
        console.error('Failed to update webhook:', error);
        process.exit(1);
    }
}

const threads = [
    {
        topicName: config.google.pubSubConfig.topicName,
        subscriptionName: config.google.pubSubConfig.subscriptionName,
        webhookSubPath: 'gmail/subscription'
    },
    {
        topicName: config.exchange.pubSubConfig.topicName,
        subscriptionName: config.exchange.pubSubConfig.subscriptionName,
        webhookSubPath: 'exchange/subscription'
    }
].map(kwargs => updateWebhook(kwargs));

Promise.all(threads);