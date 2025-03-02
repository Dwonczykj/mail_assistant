import { Injectable, OnModuleInit } from '@nestjs/common';
import { RequestContext } from './request-context';
import { ServiceUserService } from '../auth/services/service-user.service';
import { ILogger } from '../logger/ILogger';
import { Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DaemonContextInitializerService implements OnModuleInit {
    constructor(
        private readonly serviceUserService: ServiceUserService,
        @Inject('ILogger') private readonly logger: ILogger,
        private readonly dataSource: DataSource,
    ) { }

    /**
     * Initializes the RequestContext with the service user when the module is initialized
     */
    async onModuleInit() {
        try {
            this.logger.info('Initializing daemon context with service user');

            // Ensure TypeORM is fully initialized
            await this.ensureTypeOrmInitialized();

            const serviceUserId = await this.serviceUserService.getServiceUserId();
            const serviceUser = await this.serviceUserService.getServiceUser();

            if (!serviceUser) {
                throw new Error('Failed to get service user');
            }

            // Set the context directly
            RequestContext.set({ user: serviceUser });

            // Verify the context was set correctly
            const contextData = RequestContext.get();
            if (!contextData.user) {
                this.logger.warn('RequestContext user is null after setting it');
            } else {
                this.logger.info(`RequestContext initialized with user: ${contextData.user.email}`);
            }

            this.logger.info('Daemon context initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize daemon context:', { error });
            throw error;
        }
    }

    /**
     * Ensures TypeORM is fully initialized by checking if the connection is ready
     * and the entity metadata is loaded
     */
    private async ensureTypeOrmInitialized(): Promise<void> {
        if (!this.dataSource.isInitialized) {
            this.logger.info('Waiting for TypeORM to initialize...');
            await this.dataSource.initialize();
        }

        // Verify that User entity metadata is available
        try {
            this.dataSource.getMetadata('User');
            this.logger.info('TypeORM initialized with User entity metadata');
        } catch (error) {
            this.logger.error('User entity metadata not found, trying to synchronize schema', { error });
            // Force synchronization to ensure metadata is loaded
            await this.dataSource.synchronize(false);
        }
    }
} 