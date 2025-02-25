import { IAmEmailService } from "./IAmEmailService";
import { ILogger } from "../lib/logger/ILogger";
import { IMockEmailRepository } from "../Repository/IMockEmailRepository";
import { ProcessedObjectRepository } from '../Repository/ProcessedObjectRepository';
import { ObjectType } from '../data/entity/ProcessedObject';
import { Inject, Injectable } from "@nestjs/common";
import { GmailService } from "./GmailService";
import { Email } from "../models/Email";

@Injectable()
export class EmailServiceManager {
    private emailServices: IAmEmailService[] = [];

    constructor(
        @Inject('ILogger') private readonly logger: ILogger,
        @Inject('ProcessedObjectRepository') private readonly processedObjectRepo: ProcessedObjectRepository,
        @Inject('IMockEmailRepository') private readonly emailRepository: IMockEmailRepository,
        @Inject('GmailService') private readonly gmailService: GmailService,
    ) {
        this.emailServices.push(this.gmailService);
    }

    public async getEmailServices(): Promise<IAmEmailService[]> {
        return this.emailServices;
    }

    public async getEmailService(serviceName: string): Promise<IAmEmailService> {
        const service = this.emailServices.find(service => service.name === serviceName);
        if (!service) {
            this.logger.error(`Email service [${serviceName}] not found`);
            throw new Error(`Email service ${serviceName} not found`);
        }
        return service;
    }

    public async registerMailboxListeners(): Promise<void> {
        for (const service of this.emailServices) {
            await service.listenerService.start();
        }
    }

    public async destroyMailboxListeners(): Promise<void> {
        for (const service of this.emailServices) {
            await service.listenerService.stop();
        }
    }

    // Both of these methods are examplle methods to demonstrate that the functionality of connecting to emails is working.
    public async fetchAndLabelLastEmails({ serviceName = "*", lastNHours, count }: { serviceName?: string, lastNHours?: number, count: number }): Promise<Email[]> {
        this.logger.info(`Fetching and labeling last ${count} emails from ${serviceName}`);
        const emailServiceTuples = await this.lastNEmails({ serviceName, lastNHours, count });
        const promises = emailServiceTuples.map(async ({ service, email }) => {
            const categorisedEmail = await service.categoriseEmail(email);
            return categorisedEmail;
        });
        // TODO: This needs to be refactored to push messages to a the event bus and we would then need to read from the event bus by subscribing to a topic from the email listeners which are registered in the services from the worker.
        const listOfListOfCategorisedEmails = await Promise.all(promises);
        // what is the synatax to flatten a list of lists?
        const categorisedEmails = listOfListOfCategorisedEmails.flat();
        this.logger.info(`Fetched ${categorisedEmails.length} emails from [${emailServiceTuples.map(obj => obj.service.name).join(", ")}]`);
        return categorisedEmails;
    }

    public async fetchLastNEmails({ serviceName = "*", lastNHours, count }: { serviceName?: string, lastNHours?: number, count: number }): Promise<{ email: Email, service: IAmEmailService }[]> {
        this.logger.info(`Fetching last ${count} emails from ${serviceName}`);
        const emailServiceTuples = await this.lastNEmails({ serviceName, lastNHours, count });
        for (const { email, service } of emailServiceTuples) {
            // await this.categoriseEmail(email);
            this.logger.debug(`Email: "${email.subject}" from Service: [${service.name}]`);
        }
        return emailServiceTuples;
    }

    public async saveLastNEmails({ serviceName = "*", lastNHours, count }: { serviceName?: string, lastNHours?: number, count: number }): Promise<void> {
        this.logger.info(`Saving last ${count} emails from ${serviceName}`);
        const emailServiceTuples = await this.lastNEmails({ serviceName, lastNHours, count });
        await this.emailRepository.saveEmails(emailServiceTuples);
        this.logger.info(`Saved ${emailServiceTuples.length} emails to mock email repository`);
    }

    private async lastNEmails({ serviceName = "*", lastNHours, count }: { serviceName?: string, lastNHours?: number, count: number }): Promise<{ email: Email, service: IAmEmailService }[]> {
        const services = serviceName === "*" ? this.emailServices : [await this.getEmailService(serviceName)];
        const promises = services.map(async service => ({ service, emails: await service.fetchLastEmails({ count, lastNHours }) }));
        // TODO: This needs to be refactored to push messages to a the event bus and we would then need to read from the event bus by subscribing to a topic from the email listeners which are registered in the services from the worker.
        const listOfListOfEmails = await Promise.all(promises);
        const emailServiceTuples = listOfListOfEmails.map(obj => obj.emails.map(email => ({ email, service: obj.service }))).flat();
        return emailServiceTuples;
    }

    public async processObjects({
        serviceName = "*",
        lastNHours = 24,
        objectType = "*" as ObjectType
    }: {
        serviceName?: string;
        lastNHours?: number;
        objectType?: ObjectType;
    }): Promise<void> {
        this.logger.info(`Processing objects from last ${lastNHours} hours for service ${serviceName} of type ${objectType}`);

        const objects = await this.processedObjectRepo.findByTimeRange({
            lastNHours,
            objectType
        });

        this.logger.info(`Found ${objects.length} objects to process`);

        // Process each object based on its type
        const seenEmails = new Set<string>();
        for (const object of objects) {
            try {
                switch (object.type) {
                    case 'email':
                        if (seenEmails.has(object.message_id)) {
                            this.logger.info(`Skipping duplicate email: ${object.message_id} in EmailServiceManager.processObjects`);
                            break;
                        }
                        seenEmails.add(object.message_id);
                        break;
                    // Add other object type processing as needed
                    default:
                        this.logger.warn(`Unhandled object type: ${object.type}`);
                }
            } catch (error) {
                this.logger.error(`Error processing object ${object.id}`, { error });
            }
        }

        const emailServiceTuples = await this.fetchLastNEmails({ serviceName, lastNHours, count: 100 });
        for (const { email, service } of emailServiceTuples) {
            if (!seenEmails.has(email.messageId)) {
                await this.processEmail({ email, service });
            }
        }
    }

    private async processEmail({ email, service }: { email: Email, service: IAmEmailService }): Promise<void> {
        await service.categoriseEmail(email);
    }
}   