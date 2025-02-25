import { IMailListener } from "./IMailListener";
import { GmailClient } from "../Repository/GmailClient";
import { Injectable, Inject, OnModuleInit, OnModuleDestroy, OnApplicationShutdown, OnApplicationBootstrap } from '@nestjs/common';
import { ILogger } from "../lib/logger/ILogger";
import { OAuth2Client } from "google-auth-library";

@Injectable()
export class GmailListenerService implements IMailListener {
    private oAuthClient: OAuth2Client | null = null;

    constructor(@Inject(GmailClient) private readonly emailClient: GmailClient, @Inject("ILogger") private readonly logger: ILogger) { }

    // async onApplicationBootstrap() {
    //     await this.start();
    // }

    // async onApplicationShutdown() {
    //     await this.stop();
    // }

    // async onModuleInit() {
    //     // await this.start();
    // }

    // async onModuleDestroy() {
    //     // await this.stop();
    // }

    async authenticate({ oAuthClient }: { oAuthClient: OAuth2Client }): Promise<void> {
        this.oAuthClient = oAuthClient;
    }

    async start(): Promise<void> {
        if (!(await this.emailClient.authenticated)) {
            if (!this.oAuthClient) {
                throw new Error("OAuth client not authenticated");
            }
            await this.emailClient.authenticate({ oAuthClient: this.oAuthClient });
        }
        await this.emailClient.listenForIncomingEmails();
    }

    async stop(): Promise<void> { // TODO: Ensure this method is called when the app shuts down or when the service is stopped using a with block. like pythonic __enter__ and __exit__ methods. What is this called in NestJS?
        await this.emailClient.killIncomingEmailListener();
    }

    // TODO: Challenge task, draw out a system diagram for this project (10 minutes and explain why you have included each component and what you would do if you had more time)
    // 1. Feature requirements:
    // 1. App must be able to start and start the mail_manager singleton which manages the mail_listeners and mail_observers. MailListeners use the gmail_client to listen for gmail. MailObservers subscribe to topics on the event store.
    // ✅ 2. App must be able to fetch the last 10 emails from the inbox.
    // 3. App must be able to add handlers (subscribers / observers) in a manner that is loosely coupled for handling events from the stream of type new_email_received.
    // 4. One of the handlers should categorise the email.
    // ✅ 6. The app should have loosely coupled logger using dependency injection provded by inversify.
    // ✅ The component that handles labelling should be loosely coupled from the component that decided which label to apply.
    // 7. the component that asks gmail to watch for events should be run if not already watching for events from gmail. We then need to find out if we need a webhook for this or somethign else?
    // 8. the observers are different types of components and should subscribe to the webhook event that is triggered by gmail when a new email is received.
    // 9. the app needs to automatically cancel all watches and observers on shutdown or failure using with blocks. etc
    // 10. the app should be able to run multiple services concurrently.
    // Dont worry about perrsistence until second iteration of project.
    // Dont worry about the nestjs scalable architecture yet.
    // Dont worry about configuring the RabbitMQ message broker (bus) yet or the event store, but instead have an interface IBus that takes care of this for now so that we can sub it out in the future (same for the event store)
    // Dont worry about socket.io or websockets yet.
    // Dont worry about the UI / frontend yet.
    // Dont worry about the tests yet.
    // Dont worry about the docker / kubernetes yet.
    // Dont worry about the security yet.
    // Dont worry about the monitoring / observability yet.    
}

