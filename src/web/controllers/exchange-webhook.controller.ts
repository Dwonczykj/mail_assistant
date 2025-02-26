import { Controller, Post, Body, Logger, Injectable, Inject } from '@nestjs/common';
import { EmailServiceManager } from '../../EmailService/EmailServiceManager';
import { ProcessedObjectRepository } from '../../Repository/ProcessedObjectRepository';
import { ILogger } from '../../lib/logger/ILogger';
import { PubSub } from '@google-cloud/pubsub';
import { config } from '../../Config/config';
import { ExchangeAdaptor } from '../../models/ExchangeAdaptor';
import { IProcessor } from '../../lib/utils/IProcessor';

@Controller('webhooks/exchange')
@Injectable()
export class ExchangeWebhookController {
    // private readonly logger = new Logger(GmailWebhookController.name);

    constructor(
        @Inject('ProcessedObjectRepository') private readonly processedObjectRepo: ProcessedObjectRepository,
        @Inject('EmailServiceManager') private readonly emailServiceManager: EmailServiceManager,
        @Inject('ILogger') private readonly logger: ILogger,
        @Inject('ExchangeEmailGraphAPIPushProcessor') private readonly exchangeEmailGraphAPIPushProcessor: IProcessor<any>,
        @Inject('ExchangeEmailGraphAPIPubSubPublishProcessor') private readonly exchangeEmailGraphAPIPubSubPublishProcessor: IProcessor<any>,
    ) { }

    @Post('subscription')
    async handlePushNotification(@Body() payload: any): Promise<void> {
        this.logger.info('Received Exchange push notification from PubSub subscription');
        // Do Nothing as already processed by publish method
    }

    @Post('publish')
    async handleExchangePushNotificationAndPublishToPubSub(@Body() payload: any): Promise<void> {
        this.logger.info('Received Exchange push notification');
        const notifications = payload.value.data;
        this.logger.info(`Received ${notifications.length} Graph notifications from Exchange`);
        let pubsubMessageCount = 0;
        for (const notification of notifications) {
            this.logger.info(`Processing email: ${notification.id} from payload: ${JSON.stringify(notification).slice(0, 100)}[:100]... in ExchangeWebhookController.handlePushNotification`);
            this.exchangeEmailGraphAPIPushProcessor.run(notification);
            this.exchangeEmailGraphAPIPubSubPublishProcessor.run(notification);
            pubsubMessageCount++;
        }
        if (pubsubMessageCount > 0) {
            this.logger.info(`Published ${pubsubMessageCount} exchange emails in POST request to Pub/Sub`);
            return;
        }
    }
} 