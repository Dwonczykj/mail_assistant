import { Inject, Injectable } from '@nestjs/common';
import { IProcessor } from '../../lib/utils/IProcessor';
import { EmailServiceManager } from '../../EmailService/EmailServiceManager';
import { ILogger } from '../../lib/logger/ILogger';
import { ProcessedObjectRepository } from '../../Repository/ProcessedObjectRepository';

@Injectable()
export class PubSubGmailSubscriptionPushProcessor implements IProcessor<any> {

    constructor(
        @Inject('ProcessedObjectRepository') private readonly processedObjectRepo: ProcessedObjectRepository,
        @Inject('EmailServiceManager') private readonly emailServiceManager: EmailServiceManager,
        @Inject('ILogger') private readonly logger: ILogger,
    ) { }

    async run(payload: any): Promise<void> {
        this.logger.info(`Processing Gmail push notification from PubSub subscription with payload: ${JSON.stringify(payload)}`);
        return;
        const data = payload.value.data;
        const service = await this.emailServiceManager.getEmailService('gmail');
        const emailAdaptor = service.getEmailAdaptor();
        if (!emailAdaptor.validate(data)) {
            this.logger.error(`Invalid email from payload: ${JSON.stringify(payload)}`);
            return;
        }
        const email = emailAdaptor.adapt(data);
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
