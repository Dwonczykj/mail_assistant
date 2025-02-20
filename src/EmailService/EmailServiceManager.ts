import { IAmEmailService } from "./IAmEmailService";
import { ILogger } from "../lib/logger/ILogger";
import { container } from "tsyringe";
import { EmailServiceFactory } from "./EmailServiceFactory";
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
    public async fetchAndLabelLastEmails(serviceName: string, count: number): Promise<void> {
        const service = await this.getEmailService(serviceName);
        const emails = await service.fetchLastEmails(count);
        for (const email of emails) {
            await service.categoriseEmail(email);
        }
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

}   