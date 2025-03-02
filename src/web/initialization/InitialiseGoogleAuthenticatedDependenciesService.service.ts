import { Injectable, OnModuleInit, Inject, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ILogger } from '../../lib/logger/ILogger';
import { EmailServiceManager } from '../../EmailService/EmailServiceManager';


@Injectable()
export class InitialiseGoogleAuthenticatedDependenciesService implements OnApplicationShutdown {
    constructor(
        @Inject('ILogger')
        private readonly logger: ILogger,
        @Inject('EmailServiceManager')
        private readonly emailServiceManager: EmailServiceManager,
    ) { }

    async initialiseDependencies(token: string) {
        this.logger.info('Initializing Gmail service...');
        // TODO: Can we use our own jwt token that we provide here to retrieve google auth credentials?
        await this.emailServiceManager.registerMailboxListeners();
        this.logger.info('Gmail service initialized successfully');
    }

    async onApplicationShutdown() {
        await this.emailServiceManager.destroyMailboxListeners();
    }
} 