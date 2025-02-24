import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import dotenv from 'dotenv';

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

async function updateWebhook(): Promise<void> {
    try {
        // Get the ngrok URL
        const ngrokUrl = await getNgrokUrl();
        console.log(`Found ngrok URL: ${ngrokUrl}`);

        // Update the Pub/Sub subscription
        const subscriptionCommand = `gcloud pubsub subscriptions update gmail-notifications-sub --push-endpoint=${ngrokUrl}/webhooks/gmail`;
        const { stdout, stderr } = await execAsync(subscriptionCommand);

        if (stderr) {
            console.error('Error updating subscription:', stderr);
            return;
        }

        console.log('Successfully updated webhook URL:', stdout);
    } catch (error) {
        console.error('Failed to update webhook:', error);
        process.exit(1);
    }
}

updateWebhook(); 