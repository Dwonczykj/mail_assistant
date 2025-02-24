import { Controller, Post, Body, Logger } from '@nestjs/common';
import { EmailServiceManager } from '../../EmailService/EmailServiceManager';
import { ProcessedObjectRepository } from '../../Repository/ProcessedObjectRepository';
import { container } from '../../container';

@Controller('webhooks/gmail')
export class GmailWebhookController {
    private readonly logger = new Logger(GmailWebhookController.name);
    private readonly processedObjectRepo: ProcessedObjectRepository;

    constructor() {
        this.processedObjectRepo = container.resolve(ProcessedObjectRepository);
    }

    @Post()
    async handlePushNotification(@Body() payload: any): Promise<void> {
        this.logger.log('Received Gmail push notification');

        const emailServiceManager = EmailServiceManager.getInstance();
        const gmailService = await emailServiceManager.getEmailService('gmail');

        // Fetch and process the new email 
        // TODO: Should the most recent email not be in the payload?
        const emails = await gmailService.fetchLastEmails(1);

        for (const email of emails) {
            // Save to processed objects log
            await this.processedObjectRepo.save({
                project_id: email.threadId, // You might want to implement proper project ID logic
                thread_id: email.threadId,
                message_id: email.messageId,
                type: 'email',
                result: JSON.stringify(email),
                object_timestamp: new Date(email.timestamp)
            });

            // Process the email
            await gmailService.categoriseEmail(email);
        }
    }
} 