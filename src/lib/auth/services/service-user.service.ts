import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../../../data/entity/User';
import { AuthUser } from '../../../data/entity/AuthUser';
import { AuthProvider } from '../../../data/entity/AuthUser';
import { UserCredentials, UserCredentialsService } from './user-credentials.service';
import { ILogger } from '../../logger/ILogger';
import { Inject } from '@nestjs/common';
import { config } from '../../../Config/config';
import { RequestContext } from '../../context/request-context';

@Injectable()
export class ServiceUserService {
    private serviceUserId: string | null = null;
    private serviceUser: User | null = null;
    private serviceUserCredentials: UserCredentials | null = null;

    constructor(
        private readonly dataSource: DataSource,
        private readonly userCredentialsService: UserCredentialsService,
        @Inject('ILogger') private readonly logger: ILogger,
    ) { }

    public getServiceUser(): User | null {
        return this.serviceUser;
    }

    public getServiceUserCredentials(): UserCredentials | null {
        return this.serviceUserCredentials;
    }

    /**
     * Initializes a service user account if one doesn't exist
     * @returns The ID of the service user
     */
    async initializeServiceUser(): Promise<string> {
        if (this.serviceUserId) {
            return this.serviceUserId;
        }

        try {
            // Check if service user already exists
            const userRepository = this.dataSource.getRepository(User);
            let serviceUser = await userRepository.findOne({
                where: { email: config.serviceUser?.email }
            });

            // Create service user if it doesn't exist
            if (!serviceUser) {
                this.logger.info('Creating service user account');

                serviceUser = new User();
                serviceUser.email = config.serviceUser?.email;
                serviceUser.firstName = config.serviceUser?.firstName;
                serviceUser.lastName = config.serviceUser?.lastName;

                await userRepository.save(serviceUser);
                this.logger.info(`Service user created with ID: ${serviceUser.id}`);
            }

            this.serviceUserId = serviceUser.id;
            this.logger.debug(`Service user ID set to: ${this.serviceUserId}`);
            this.serviceUser = serviceUser;

            // Check if we have stored credentials for this service user
            const userCredentials = await this.userCredentialsService.getUserCredentials(
                serviceUser.id,
                AuthProvider.GOOGLE
            );

            // If we have service credentials in config, store them
            if (!userCredentials && config.serviceUser?.credentials) {
                const newCredentials = { ...config.serviceUser.credentials };
                this.logger.info(`Updating service user credentials from credentials \n${JSON.stringify(config.serviceUser.credentials)} \nand config: \n${JSON.stringify(config.serviceUser)}`);
                await this.userCredentialsService.saveUserCredentials(
                    serviceUser.id,
                    AuthProvider.GOOGLE,
                    {
                        accessToken: newCredentials.accessToken,
                        refreshToken: newCredentials.refreshToken,
                        expiryDate: new Date(newCredentials.expiryDate || Date.now() + 3600000),
                    }
                );
                this.logger.info('Service user credentials saved');
            }
            this.serviceUserCredentials = userCredentials;

            return serviceUser.id;
        } catch (error) {
            this.logger.error('Failed to initialize service user:', { error });
            throw error;
        }
    }

    public async setServiceUserToContext(serviceUserId: string): Promise<void> {
        this.serviceUserId = serviceUserId;

        // Get the service user from the database
        this.serviceUser = await this.dataSource.getRepository(User).findOne({ where: { id: serviceUserId } });

        if (!this.serviceUser) {
            this.logger.error(`Service user with ID ${serviceUserId} not found`);
            throw new Error(`Service user with ID ${serviceUserId} not found`);
        }

        this.serviceUserCredentials = await this.userCredentialsService.getUserCredentials(serviceUserId, AuthProvider.GOOGLE);

        // Initialize the RequestContext with the service user
        RequestContext.set({ user: JSON.parse(JSON.stringify(this.serviceUser)) });

        // Verify the context was set correctly
        const contextData = RequestContext.get();
        this.logger.info(`Set service user to context: ${this.serviceUser.email}, context user: ${contextData.user ? contextData.user.email : 'null'}`);
    }

    /**
     * Gets the service user ID
     */
    async getServiceUserId(): Promise<string> {
        if (!this.serviceUserId) {
            return this.initializeServiceUser();
        }
        return this.serviceUserId;
    }
} 