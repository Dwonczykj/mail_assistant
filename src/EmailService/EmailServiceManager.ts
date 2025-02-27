import { IAmEmailService } from "./IAmEmailService";
import { ILogger } from "../lib/logger/ILogger";
import { IMockEmailRepository } from "../Repository/IMockEmailRepository";
import { ProcessedObjectRepository } from '../Repository/ProcessedObjectRepository';
import { ObjectType } from '../data/entity/ProcessedObject';
import { Inject, Injectable } from "@nestjs/common";
import { GmailService } from "./GmailService";
import { Email } from "../models/Email";
import { OAuth2Client } from "google-auth-library";
import { IGetOAuthClient, IReceiveOAuthClient } from "../lib/utils/IGoogleAuth";
import { GoogleAuthFactoryService, AuthEnvironment } from '../lib/auth/services/google-auth-factory.service';
import { IGoogleAuthService } from '../lib/auth/interfaces/google-auth.interface';
import { UserCredentialsService, UserCredentials } from '../lib/auth/services/user-credentials.service';
import { AuthProvider } from '../data/entity/AuthUser';
import { config } from "../Config/config";

class BulkProcessors {
    constructor(private readonly emailRepository: IMockEmailRepository) { }
    async saveEmailsProcessor(emailTuples: { email: Email, service: IAmEmailService }[]): Promise<{ email: Email, service: IAmEmailService }[]> {
        await this.emailRepository.saveEmails(emailTuples);
        return emailTuples;
    }
}

class UnitProcessors {
    async labelEmailProcessor(email: Email, service: IAmEmailService): Promise<{ email: Email, service: IAmEmailService }> {
        const labelledEmail = await service.categoriseEmail(email);
        return Promise.resolve({ email: labelledEmail, service: service });
    }
}

@Injectable()
export class EmailServiceManager implements IGetOAuthClient {
    private emailServices: IAmEmailService[] = [];
    private googleAuthService: IGoogleAuthService;
    private currentUserId: string | null = null;

    constructor(
        @Inject('ILogger') private readonly logger: ILogger,
        @Inject('ProcessedObjectRepository') private readonly processedObjectRepo: ProcessedObjectRepository,
        @Inject('IMockEmailRepository') private readonly emailRepository: IMockEmailRepository,
        @Inject('GmailService') private readonly gmailService: GmailService,
        private readonly googleAuthFactoryService: GoogleAuthFactoryService,
        @Inject('APP_ENVIRONMENT') private readonly environment: AuthEnvironment,
        private readonly userCredentialsService: UserCredentialsService,
    ) {
        this.googleAuthService = this.googleAuthFactoryService.getAuthService(this.environment);
        this.logger.info(`EmailServiceManager created with auth service: ${this.googleAuthService.constructor.name} in environment: ${this.environment}`);
        this.emailServices.push(this.gmailService);
    }

    /**
     * Sets the current user context for all operations
     * @param userId The ID of the user to set as current
     */
    public setCurrentUser(userId: string): void {
        this.currentUserId = userId;
        this.logger.info(`Set current user to: ${userId}`);
    }

    /**
     * Sets credentials for a specific service from the database
     * @param serviceName The name of the service (e.g., "gmail")
     * @param userId The ID of the user whose credentials to use
     */
    public async setCredentialsForService(serviceName: string, userId: string): Promise<boolean> {
        try {
            if (!userId) {
                throw new Error('User ID is required to set credentials');
            }

            const provider = await this.userCredentialsService.getProviderForService(serviceName);
            const credentials = await this.userCredentialsService.getUserCredentials(userId, provider);

            if (!credentials) {
                this.logger.error(`No credentials found for user ${userId} with service ${serviceName}`);
                return false;
            }

            // Find the service
            const service = this.emailServices.find(s => s.name.toLowerCase() === serviceName.toLowerCase());
            if (!service) {
                this.logger.error(`Service ${serviceName} not found`);
                return false;
            }

            // Set the credentials on the service
            await this.applyCredentialsToService(service, credentials);
            this.setCurrentUser(userId);

            return true;
        } catch (error) {
            this.logger.error(`Error setting credentials for service ${serviceName}:`, { error });
            return false;
        }
    }

    /**
     * Applies credentials to a specific service
     */
    private async applyCredentialsToService(service: IAmEmailService, credentials: UserCredentials): Promise<void> {
        // Create or update OAuth client with the credentials
        const oAuthClient = new OAuth2Client({
            clientId: config.googleClientId,
            clientSecret: config.googleClientSecret,
            redirectUri: config.googleRedirectUri,
        });

        oAuthClient.setCredentials({
            access_token: credentials.accessToken,
            refresh_token: credentials.refreshToken,
            expiry_date: credentials.expiryDate ? credentials.expiryDate.getTime() : undefined,
        });

        // Authenticate the service with these credentials
        await service.authenticate({ oAuthClient });
        this.logger.info(`Applied credentials to service: ${service.name}`);
    }

    /**
     * Refreshes tokens if needed and updates the database
     */
    public async refreshTokensIfNeeded(serviceName: string): Promise<boolean> {
        try {
            if (!this.currentUserId) {
                this.logger.error('No current user set, cannot refresh tokens');
                return false;
            }

            const service = this.emailServices.find(s => s.name.toLowerCase() === serviceName.toLowerCase());
            if (!service) {
                this.logger.error(`Service ${serviceName} not found`);
                return false;
            }

            // Check if the service has a method to check if token refresh is needed
            const needsRefresh = await service.needsTokenRefresh();

            if (needsRefresh) {
                // Refresh the token
                const provider = await this.userCredentialsService.getProviderForService(serviceName);
                const newCreds = await this.googleAuthService.refreshTokenIfNeeded();

                // Update the database
                await this.userCredentialsService.updateUserCredentials(
                    this.currentUserId,
                    provider,
                    {
                        accessToken: newCreds.accessToken,
                        refreshToken: newCreds.refreshToken,
                        expiryDate: newCreds.expiryDate
                    }
                );

                // Update the service
                await this.setCredentialsForService(serviceName, this.currentUserId);

                this.logger.info(`Refreshed tokens for service: ${serviceName}`);
                return true;
            }
            return false;
        } catch (error) {
            this.logger.error(`Error refreshing tokens for service ${serviceName}:`, { error });
            return false;
        }
    }

    // Existing authenticate method with modifications to use user credentials
    public async authenticate(): Promise<OAuth2Client | null> {
        // If we have a current user, try to use their credentials
        if (this.currentUserId) {
            try {
                // For each service, set credentials from the database
                for (const service of this.emailServices) {
                    await this.setCredentialsForService(service.name, this.currentUserId);
                }
                return this.googleAuthService.oAuthClient;
            } catch (error) {
                this.logger.error(`Failed to authenticate with user credentials: ${error}`, { error });
                // Fall back to default authentication
            }
        }

        // Default authentication flow
        const oauthClient = await this.googleAuthService.authenticate() || new OAuth2Client();
        if (!oauthClient) {
            this.logger.error("Failed to authenticate EmailServiceManager as google auth service returned null");
            return null;
        }
        const authPromises = this.emailServices.map(service => service.authenticate({ oAuthClient: oauthClient }));
        await Promise.all(authPromises);
        return oauthClient;
    }

    public get oAuthClient(): OAuth2Client {
        return this.googleAuthService.oAuthClient;
    }

    public get authenticated(): Promise<boolean> {
        if (!this.emailServices.every(service => service.authenticated)) {
            return Promise.resolve(false);
        }
        return this.googleAuthService.isAuthenticated();
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

    public async fetchMail<T>({ processor, serviceName = "*", lastNHours, count, reapply = false }: { processor: (email: Email, service: IAmEmailService) => Promise<T>, serviceName?: string, lastNHours?: number, count: number, reapply?: boolean }): Promise<T[]> {
        // Ensure authentication before fetching mail
        await this.ensureAuthenticated(serviceName !== "*" ? serviceName : undefined);

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

    public async fetchLastNEmails({ serviceName = "*", lastNHours, count }: { serviceName?: string, lastNHours?: number, count: number }): Promise<{ email: Email, service: IAmEmailService }[]> {
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

    // Method to ensure authentication before operations
    private async ensureAuthenticated(serviceName?: string): Promise<void> {
        if (serviceName) {
            // Refresh tokens for specific service if needed
            await this.refreshTokensIfNeeded(serviceName);
        } else {
            // Check all services
            for (const service of this.emailServices) {
                await this.refreshTokensIfNeeded(service.name);
            }
        }
    }

    // Modify existing methods to ensure authentication before operations
    async someGmailOperation(): Promise<void> {
        await this.ensureAuthenticated('gmail');
        // Now perform the operation with valid credentials
    }
}   