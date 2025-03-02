import { IAmEmailService } from "./IAmEmailService";
import { ILogger } from "../lib/logger/ILogger";
import { IMockEmailRepository } from "../Repository/IMockEmailRepository";
import { ProcessedObjectRepository } from '../Repository/ProcessedObjectRepository';
import { ObjectType } from '../data/entity/ProcessedObject';
import { Inject, Injectable } from "@nestjs/common";
import { GmailService } from "./GmailService";
import { Email } from "../models/Email";
import { OAuth2Client } from "google-auth-library";
import { IGoogleAuthService, IGoogleAuthService2 } from '../lib/auth/interfaces/google-auth.interface';
import { UserCredentialsService, UserCredentials } from '../lib/auth/services/user-credentials.service';
import { config } from "../Config/config";
import { ServiceUserService } from '../lib/auth/services/service-user.service';

class BulkProcessors {
    constructor(private readonly emailRepository: IMockEmailRepository) { }
    async saveEmailsProcessor<TProviderEmail extends any>(emailTuples: { email: Email, service: IAmEmailService<TProviderEmail> }[]): Promise<{ email: Email, service: IAmEmailService<TProviderEmail> }[]> {
        await this.emailRepository.saveEmails(emailTuples);
        return emailTuples;
    }
}

class UnitProcessors {
    async labelEmailProcessor<TProviderEmail extends any>(email: Email, service: IAmEmailService<TProviderEmail>): Promise<{ email: Email, service: IAmEmailService<TProviderEmail> }> {
        const labelledEmail = await service.categoriseEmail(email);
        return Promise.resolve({ email: labelledEmail, service: service });
    }
}

@Injectable()
export class EmailServiceManager {
    private emailServices: IAmEmailService<any>[] = [];
    private currentUserId: string | null = null;

    constructor(
        @Inject('ILogger') private readonly logger: ILogger,
        @Inject('ProcessedObjectRepository') private readonly processedObjectRepo: ProcessedObjectRepository,
        @Inject('IMockEmailRepository') private readonly emailRepository: IMockEmailRepository,
        @Inject('GmailService') private readonly gmailService: GmailService,
        @Inject('IGoogleAuthService') private readonly googleAuthService: IGoogleAuthService2,
        private readonly userCredentialsService: UserCredentialsService,
        private readonly serviceUserService: ServiceUserService,
    ) {
        this.logger.info(`EmailServiceManager created with auth service: ${this.googleAuthService.constructor.name}`);
        this.emailServices.push(this.gmailService);
    }

    public async getEmailServices(): Promise<IAmEmailService<any>[]> {
        return this.emailServices;
    }

    public async getEmailService(serviceName: string): Promise<IAmEmailService<any>> {
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
        this.logger.info('All mailbox listeners registered successfully');
    }

    public async destroyMailboxListeners(): Promise<void> {
        for (const service of this.emailServices) {
            await service.listenerService.stop();
        }
        this.logger.info('All mailbox listeners destroyed successfully');
    }

    public async getListenerStatus(): Promise<{ [serviceName: string]: boolean }> {
        const status: { [serviceName: string]: boolean } = {};
        for (const service of this.emailServices) {
            status[service.name] = service.listenerService.isActive();
        }
        return status;
    }

    public async fetchMail<T>({ processor, serviceName = "*", lastNHours, count, reapply = false }: { processor: (email: Email, service: IAmEmailService<any>) => Promise<T>, serviceName?: string, lastNHours?: number, count: number, reapply?: boolean }): Promise<T[]> {
        this.logger.debug(`Fetching last ${count} emails from ${serviceName}`);
        const emailServiceTuples = await this.lastNEmails({ serviceName, lastNHours, count });
        if (!reapply) {
            const seenObjects = await this.processedObjectRepo.findByTimeRange({
                lastNHours,
                objectType: ObjectType.EMAIL
            });
            const processingPromises = emailServiceTuples.filter(obj => !seenObjects.some(seenObj => seenObj.message_id === obj.email.messageId)).map(async ({ email, service }) => {
                return processor(email, service);
            });
            this.logger.info(`Applying ${processor.name} to ${processingPromises.length} new emails.`);
            return await Promise.all(processingPromises);
        } else {
            const processingPromises = emailServiceTuples.map(async ({ email, service }) => {
                return processor(email, service);
            });
            this.logger.info(`ReApplying ${processor.name} to ${processingPromises.length} to new and seen emails.`);
            return await Promise.all(processingPromises);
        }
    }

    // Both of these methods are examplle methods to demonstrate that the functionality of connecting to emails is working.
    public async fetchAndLabelLastEmails({ serviceName = "*", lastNHours, count, relabel = false }: { serviceName?: string, lastNHours?: number, count: number, relabel?: boolean }): Promise<Email[]> {
        return this.fetchMail({ processor: (email, service) => service.categoriseEmail(email), serviceName, lastNHours, count, reapply: relabel });
    }

    public async fetchLastNEmails({ serviceName = "*", lastNHours, count }: { serviceName?: string, lastNHours?: number, count: number }): Promise<{ email: Email, service: IAmEmailService<any> }[]> {
        return this.fetchMail({
            processor: (email, service) => {
                this.logger.debug(`Email: "${email.subject}" from Service: [${service.name}]`);
                return Promise.resolve({ email: email, service: service });
            }, serviceName, lastNHours, count
        });
    }

    public async saveLastNEmails({ serviceName = "*", lastNHours, count }: { serviceName?: string, lastNHours?: number, count: number }): Promise<void> {
        const emailServiceTuples = await this.fetchMail({
            processor: (email, service) => {
                return Promise.resolve({ email: email, service: service });
            }, serviceName, lastNHours, count, reapply: false
        });

        await this.emailRepository.saveEmails(emailServiceTuples);
        this.logger.info(`Saved ${emailServiceTuples.length} emails to mock email repository`);
    }

    private async lastNEmails({ serviceName = "*", lastNHours, count }: { serviceName?: string, lastNHours?: number, count: number }): Promise<{ email: Email, service: IAmEmailService<any> }[]> {
        const services = serviceName === "*" ? this.emailServices : [await this.getEmailService(serviceName)];
        // const serviceToAuthMaps = new Map(services.map(service => [service, service instanceof GmailService ? service.emailClientAuthenticationModule : null]));
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

    private async processEmail<TProviderEmail extends any>({ email, service }: { email: Email, service: IAmEmailService<TProviderEmail> }): Promise<void> {
        await service.categoriseEmail(email);
    }
}   