export interface PubSubConfig {
    projectId: string;
    topicName: string;
    subscriptionName: string;
}

export const pubSubConfig: PubSubConfig = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
    topicName: process.env.GOOGLE_TOPIC || `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-notifications`,
    subscriptionName: process.env.GOOGLE_SUBSCRIPTION || `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/subscriptions/gmail-notifications-sub`
}; 