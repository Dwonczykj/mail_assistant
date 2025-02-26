import { Inject, Injectable } from '@nestjs/common';
import { IProcessor } from '../../lib/utils/IProcessor';
import { EmailServiceManager } from '../../EmailService/EmailServiceManager';
import { ILogger } from '../../lib/logger/ILogger';
import { ProcessedObjectRepository } from '../../Repository/ProcessedObjectRepository';

@Injectable()
export class ExchangeEmailGraphAPIPushProcessor implements IProcessor<any> {

    constructor(
        @Inject('ProcessedObjectRepository') private readonly processedObjectRepo: ProcessedObjectRepository,
        @Inject('EmailServiceManager') private readonly emailServiceManager: EmailServiceManager,
        @Inject('ILogger') private readonly logger: ILogger,
    ) { }

    async run(payload: any): Promise<void> {
        const notification = payload.value.data;
        const exchangeEmailResource = notification.resourceData;
        // TODO: CODE SMELL: This method should use an injected email adaptor and processor rather than be tightly coupled to the ExchangeAdaptor and EmailServiceManager, the service should know which adaptor it needs?
        const service = await this.emailServiceManager.getEmailService('exchange');
        const emailAdaptor = service.getEmailAdaptor();
        try {
            if (!emailAdaptor.validate(exchangeEmailResource)) {
                this.logger.error(`Invalid email resource: ${exchangeEmailResource.id} from payload: ${JSON.stringify(notification).slice(0, 100)}[:100]... in ExchangeWebhookController.handlePushNotification`);
                this.logger.error(emailAdaptor.messages);
                return;
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
    }

}
