import { Injectable, OnModuleInit, Inject, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ILogger } from '../../lib/logger/ILogger';
import { EmailServiceManager } from '../../EmailService/EmailServiceManager';
@Injectable()
export class GmailInitService implements OnApplicationBootstrap, OnApplicationShutdown {
    constructor(
        @Inject('ILogger')
        private readonly logger: ILogger,
        @Inject('EmailServiceManager')
        private readonly emailServiceManager: EmailServiceManager,
    ) { }

    async onApplicationBootstrap() {
        this.logger.info('Initializing Gmail service...');
        await this.emailServiceManager.authenticate();
        await this.emailServiceManager.registerMailboxListeners();
        this.logger.info('Gmail service initialized successfully');
    }

    async onApplicationShutdown() {
        await this.emailServiceManager.destroyMailboxListeners();
    }
} 