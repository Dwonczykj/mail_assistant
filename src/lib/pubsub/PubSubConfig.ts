import { PubSub } from '@google-cloud/pubsub';

export class PubSubService {
    private static instance: PubSubService;
    private pubSubClient: PubSub;
    private readonly projectId: string;
    private readonly topicName: string = 'gmail-notifications';
    private readonly subscriptionName: string = 'gmail-notifications-sub';

    private constructor() {
        this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || '';
        if (!this.projectId) {
            throw new Error('GOOGLE_CLOUD_PROJECT_ID environment variable is not set');
        }
        this.pubSubClient = new PubSub({ projectId: this.projectId });
    }

    static getInstance(): PubSubService {
        if (!PubSubService.instance) {
            PubSubService.instance = new PubSubService();
        }
        return PubSubService.instance;
    }

    get fullTopicName(): string {
        return `projects/${this.projectId}/topics/${this.topicName}`;
    }

    async setupPubSub(webhookUrl: string): Promise<void> {
        // Create topic if it doesn't exist
        const [topicExists] = await this.pubSubClient.topic(this.topicName).exists();
        if (!topicExists) {
            await this.pubSubClient.createTopic(this.topicName);
        }

        // Create push subscription if it doesn't exist
        const [subscriptionExists] = await this.pubSubClient
            .topic(this.topicName)
            .subscription(this.subscriptionName)
            .exists();

        if (!subscriptionExists) {
            await this.pubSubClient.topic(this.topicName).createSubscription(
                this.subscriptionName, {
                pushConfig: {
                    pushEndpoint: webhookUrl
                }
            }
            );
        }

        // Set IAM policy to allow Gmail to publish
        await this.pubSubClient.topic(this.topicName).iam.setPolicy({
            bindings: [{
                role: 'roles/pubsub.publisher',
                members: ['serviceAccount:gmail-api-push@system.gserviceaccount.com']
            }]
        });
    }
} 