import { Controller, Post, Body, Logger, Injectable, Inject } from '@nestjs/common';
import { EmailServiceManager } from '../../EmailService/EmailServiceManager';
import { ProcessedObjectRepository } from '../../Repository/ProcessedObjectRepository';
import { ILogger } from '../../lib/logger/ILogger';
import { PubSub } from '@google-cloud/pubsub';
import { config } from '../../Config/config';
import { ExchangeAdaptor } from '../../models/ExchangeAdaptor';

@Controller('webhooks/exchange')
@Injectable()
export class ExchangeWebhookController {
    // private readonly logger = new Logger(GmailWebhookController.name);

    constructor(
        @Inject('ProcessedObjectRepository') private readonly processedObjectRepo: ProcessedObjectRepository,
        @Inject('EmailServiceManager') private readonly emailServiceManager: EmailServiceManager,
        @Inject('ILogger') private readonly logger: ILogger,
    ) { }

    @Post('subscription')
    async handlePushNotification(@Body() payload: any): Promise<void> {
        this.logger.info('Received Exchange push notification from PubSub subscription');
        // Fetch and process the new email 
        // TODO: Should the most recent email not be in the payload?
        // DO Nothing as already processed by publish method
    }

    @Post('publish')
    async handleExchangePushNotificationAndPublishToPubSub(@Body() payload: any): Promise<void> {
        this.logger.info('Received Exchange push notification');
        const notifications = payload.value.data;
        this.logger.info(`Received ${notifications.length} Graph notifications from Exchange`);

        // Publish the notification details to Pub/Sub
        const pubsub = new PubSub();
        const topicName = config.google.exchangeTopic;
        const topic = pubsub.topic(topicName);
        let pubsubMessageCount = 0;
        const emailAdaptor = new ExchangeAdaptor();
        const service = await this.emailServiceManager.getEmailService('exchange');
        for (const notification of notifications) {
            const exchangeEmailResource = notification.resourceData;
            try {
                if (!emailAdaptor.validate(exchangeEmailResource)) {
                    this.logger.error(`Invalid email resource: ${exchangeEmailResource.id} from payload: ${JSON.stringify(notification).slice(0, 100)}[:100]... in ExchangeWebhookController.handlePushNotification`);
                    this.logger.error(emailAdaptor.messages);
                    continue;
                }
                const email = emailAdaptor.adapt(exchangeEmailResource);
                // Process the email
                await service.categoriseEmail(email);
                // Save to processed objects log
                await this.processedObjectRepo.save({
                    project_id: email.threadId, // You might want to implement proper project ID logic
                    thread_id: email.threadId,
                    message_id: email.messageId,
                    type: 'email',
                    result: JSON.stringify(email),
                    object_timestamp: new Date(email.timestamp)
                });

            } catch (error) {
                this.logger.error(`Error processing email: ${exchangeEmailResource.id} from payload: ${JSON.stringify(notification).slice(0, 100)}[:100]... in ExchangeWebhookController.handlePushNotification`);
                this.logger.error(error);
            }

            this.logger.info(`Processing email: ${exchangeEmailResource.id} from payload: ${JSON.stringify(notification).slice(0, 100)}[:100]... in ExchangeWebhookController.handlePushNotification`);
            const messageBuffer = Buffer.from(JSON.stringify(notification));
            topic.publishMessage({
                data: messageBuffer
            });
            pubsubMessageCount++;
        }

        if (pubsubMessageCount > 0) {
            this.logger.info(`Published ${pubsubMessageCount} exchange emails in POST request to Pub/Sub`);
            return;
        }
    }
} 