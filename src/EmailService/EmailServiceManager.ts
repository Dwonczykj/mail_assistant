import { IAmEmailService } from "./IAmEmailService";
import { ILogger } from "../lib/logger/ILogger";
import { container } from "../container";
import { EmailServiceFactory } from "./EmailServiceFactory";
import { IMockEmailRepository } from "../Repository/IMockEmailRepository";
import { ProcessedObjectRepository } from '../Repository/ProcessedObjectRepository';
import { ObjectType } from '../data/entity/ProcessedObject';

export class EmailServiceManager {
    private static instance: EmailServiceManager | null = null;
    private emailServices: IAmEmailService[] = [];
    private logger: ILogger;
    private processedObjectRepo: ProcessedObjectRepository;

    private constructor() {
        this.emailServices = [];
        this.logger = container.resolve<ILogger>('ILogger');
        this.processedObjectRepo = container.resolve(ProcessedObjectRepository);
    }

    public static getInstance(): EmailServiceManager {
        if (!EmailServiceManager.instance) {
            EmailServiceManager.instance = new EmailServiceManager();
        }
        return EmailServiceManager.instance;
    }

    public async addEmailService(serviceName: string): Promise<void> {
        const emailService = await EmailServiceFactory.createEmailService(serviceName);
        this.emailServices.push(emailService);
        this.logger.info(`Email service [${serviceName}] added`);
    }

    public async removeEmailService(serviceName: string): Promise<void> {
        this.emailServices = this.emailServices.filter(service => service.name !== serviceName);
        this.logger.info(`Email service [${serviceName}] removed`);
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

    // Both of these methods are examplle methods to demonstrate that the functionality of connecting to emails is working.
    public async fetchAndLabelLastEmails({ serviceName = "*", count }: { serviceName?: string, count: number }): Promise<void> {
        this.logger.info(`Fetching and labeling last ${count} emails from ${serviceName}`);
        const services = serviceName === "*" ? this.emailServices : [await this.getEmailService(serviceName)];
        const promises = services.map(async service => {
            const emails = await service.fetchLastEmails(count);
            const categorisedEmails = await Promise.all(emails.map(async email => {
                return await service.categoriseEmail(email);
            }));
            return categorisedEmails;
        });
        // TODO: This needs to be refactored to push messages to a the event bus and we would then need to read from the event bus by subscribing to a topic from the email listeners which are registered in the services from the worker.
        const listOfListOfCategorisedEmails = await Promise.all(promises);
        // what is the synatax to flatten a list of lists?
        const categorisedEmails = listOfListOfCategorisedEmails.flat();
        this.logger.info(`Fetched ${categorisedEmails.length} emails from [${services.map(service => service.name).join(", ")}]`);
    }

    public async fetchLastNEmails({ serviceName = "*", count }: { serviceName?: string, count: number }): Promise<void> {
        this.logger.info(`Fetching last ${count} emails from ${serviceName}`);
        const services = serviceName === "*" ? this.emailServices : [await this.getEmailService(serviceName)];
        const promises = services.map(service => service.fetchLastEmails(count));
        // TODO: This needs to be refactored to push messages to a the event bus and we would then need to read from the event bus by subscribing to a topic from the email listeners which are registered in the services from the worker.
        const listOfListOfEmails = await Promise.all(promises);
        // what is the synatax to flatten a list of lists?
        const emails = listOfListOfEmails.flat();
        for (const email of emails) {
            // await this.categoriseEmail(email);
            this.logger.info(`Email: ${email.subject}`);
        }
    }

    public async saveLastNEmails({ serviceName = "*", count }: { serviceName?: string, count: number }): Promise<void> {
        this.logger.info(`Saving last ${count} emails from ${serviceName}`);
        const services = serviceName === "*" ? this.emailServices : [await this.getEmailService(serviceName)];
        const promises = services.map(service => service.fetchLastEmails(count));
        const listOfListOfEmails = await Promise.all(promises);
        const emails = listOfListOfEmails.flat();
        const emailRepository = container.resolve<IMockEmailRepository>('IMockEmailRepository');
        await emailRepository.saveEmails(emails);
        this.logger.info(`Saved ${emails.length} emails to mock email repository`);
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
        for (const object of objects) {
            try {
                switch (object.type) {
                    case 'email':
                        await this.processEmail(object);
                        break;
                    // Add other object type processing as needed
                    default:
                        this.logger.warn(`Unhandled object type: ${object.type}`);
                }
            } catch (error) {
                this.logger.error(`Error processing object ${object.id}`, { error });
            }
        }
    }

    private async processEmail(object: any): Promise<void> {
        // Implement email processing logic
        const services = this.emailServices;
        for (const service of services) {
            await service.categoriseEmail(JSON.parse(object.result));
        }
    }
}   