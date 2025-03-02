import { IMailListener } from "./IMailListener";
import { GmailClient } from "../Repository/GmailClient";
import { Injectable, Inject, OnModuleInit, OnModuleDestroy, OnApplicationShutdown, OnApplicationBootstrap } from '@nestjs/common';
import { ILogger } from "../lib/logger/ILogger";
import { OAuth2Client } from "google-auth-library";
import { Message, PubSub } from "@google-cloud/pubsub";
import { config } from "../Config/config";
import { Email } from "../models/Email";

@Injectable()
export class GmailListenerService implements IMailListener {
    private oAuthClient: OAuth2Client | null = null;
    private active: boolean = false;

    constructor(@Inject(GmailClient) private readonly emailClient: GmailClient, @Inject("ILogger") private readonly logger: ILogger) { }

    async authenticate({ oAuthClient }: { oAuthClient: OAuth2Client }): Promise<void> {
        this.oAuthClient = oAuthClient;
    }

    async start({processEmailCallback}: {processEmailCallback: (email: Email) => Promise<void>}): Promise<void> {
        try {
            await this.emailClient.listenForIncomingEmails({
                processEmailCallback
            });
            this.active = true;
            this.logger.info('Gmail listener started successfully');
        } catch (error) {
            this.logger.error('Failed to start Gmail listener', { error });
            this.active = false;
            throw error;
        }
    }

    async stop(): Promise<void> {
        try {
            await this.emailClient.killIncomingEmailListener();
            this.active = false;
            this.logger.info('Gmail listener stopped successfully');
        } catch (error) {
            this.logger.error('Failed to stop Gmail listener', { error });
            throw error;
        }
    }

    public isActive(): boolean {
        return this.active;
    }
}


