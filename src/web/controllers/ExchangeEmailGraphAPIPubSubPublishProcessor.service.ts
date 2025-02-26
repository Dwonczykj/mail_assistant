import { Inject, Injectable } from '@nestjs/common';
import { IProcessor } from '../../lib/utils/IProcessor';
import { ILogger } from '../../lib/logger/ILogger';
import { PubSub } from '@google-cloud/pubsub';
import { config } from '../../Config/config';

@Injectable()
export class ExchangeEmailGraphAPIPubSubPublishProcessor implements IProcessor<any> {

    constructor(
        @Inject('ILogger') private readonly logger: ILogger,
    ) { }

    async run(payload: any): Promise<void> {
        const pubsub = new PubSub();
        const topicName = config.google.exchangeTopic;
        const topic = pubsub.topic(topicName);

        const messageBuffer = Buffer.from(JSON.stringify(payload));
        try {
            topic.publishMessage({
                data: messageBuffer
            });
        } catch (error) {
            this.logger.error(`Error publishing message to Pub/Sub: ${error}`);
        }
    }

}
