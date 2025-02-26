import { Controller, Post, Body, Logger, Injectable, Inject } from '@nestjs/common';
import { EmailServiceManager } from '../../EmailService/EmailServiceManager';
import { ProcessedObjectRepository } from '../../Repository/ProcessedObjectRepository';
import { ILogger } from '../../lib/logger/ILogger';
import { IProcessor } from '../../lib/utils/IProcessor';

@Controller('webhooks/gmail')
@Injectable()
export class GmailWebhookController {
    // private readonly logger = new Logger(GmailWebhookController.name);

    constructor(
        @Inject('ProcessedObjectRepository') private readonly processedObjectRepo: ProcessedObjectRepository,
        @Inject('EmailServiceManager') private readonly emailServiceManager: EmailServiceManager,
        @Inject('ILogger') private readonly logger: ILogger,
        @Inject('PubSubGmailSubscriptionPushProcessor') private readonly pubSubGmailSubscriptionPushProcessor: IProcessor<any>,
    ) { }

    @Post('subscription')
    async handlePushNotification(@Body() payload: any): Promise<void> {
        this.logger.info('Received Gmail push notification from PubSub subscription');
        this.pubSubGmailSubscriptionPushProcessor.run(payload);
    }
} 