import { IAmEmailService } from "./IAmEmailService";
import { ILogger } from "../lib/logger/ILogger";
import { container } from "../container";
import { EmailServiceFactory } from "./EmailServiceFactory";
import { IMockEmailRepository } from "../Repository/IMockEmailRepository";
export class EmailServiceManager {
    private static instance: EmailServiceManager | null = null;
    private emailServices: IAmEmailService[] = [];
    private logger: ILogger;

    private constructor() {
        this.emailServices = [];
        this.logger = container.resolve<ILogger>('ILogger');
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
}   