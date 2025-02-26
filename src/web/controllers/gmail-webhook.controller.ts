import { Controller, Post, Body, Logger, Injectable, Inject } from '@nestjs/common';
import { EmailServiceManager } from '../../EmailService/EmailServiceManager';
import { ProcessedObjectRepository } from '../../Repository/ProcessedObjectRepository';
import { ILogger } from '../../lib/logger/ILogger';

@Controller('webhooks/gmail')
@Injectable()
export class GmailWebhookController {
    // private readonly logger = new Logger(GmailWebhookController.name);

    constructor(
        @Inject('ProcessedObjectRepository') private readonly processedObjectRepo: ProcessedObjectRepository,
        @Inject('EmailServiceManager') private readonly emailServiceManager: EmailServiceManager,
        @Inject('ILogger') private readonly logger: ILogger,
    ) { }

    @Post('subscription')
    async handlePushNotification(@Body() payload: any): Promise<void> {
        this.logger.info('Received Gmail push notification from PubSub subscription');
        // Fetch and process the new email 
        // TODO: Should the most recent email not be in the payload?
        if (Object.keys(payload).includes("message") || Object.keys(payload).includes("messages")) {
            const email = payload.message || payload.messages[0];
            this.logger.info(`Processing email: ${email.id} from payload: ${JSON.stringify(payload)} in GmailWebhookController.handlePushNotification`);
        }
        const emailServiceTuples = await this.emailServiceManager.fetchLastNEmails({ serviceName: 'gmail', count: 1 });

        for (const { email, service } of emailServiceTuples) {
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
        }
    }
} 