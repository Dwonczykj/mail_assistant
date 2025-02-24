import { CategoriserFactory } from "../Categoriser/CategoriserFactory";
import { ICategoriser } from "../Categoriser/ICategoriser";
import { Email } from "../models/Email";
import { GmailAdaptor } from "../models/GmailAdaptor";
import { LabelFactory } from "../models/Label";
import { GmailClient } from "../Repository/GmailClient";
import { IEmailClient } from "../Repository/IEmailClient";
import { IAmEmailService } from "./IAmEmailService";
import { container } from "../container";
import { ILogger } from "../lib/logger/ILogger";
import { BadClientError } from "./errors/EmailServiceErrors";

export class EmailService implements IAmEmailService {

    private readonly emailAdaptor = new GmailAdaptor(); // TODO: this is a code smell, we should only have a GmailAdaptor in the GmailService subclass of EmailService.

    constructor(private readonly emailClient: IEmailClient, public readonly name: string, private readonly logger: ILogger) {

    }

    /**
     * Categorises an email if not already labelled.
     * It extracts the subject, sender, snippet for body and timestamp from the Gmail message,
     * then passes these details to the LLMCategoriser for a categorisation label.
     * Finally, it updates the email on Gmail with the new label.
     * @param gmail_message - A Gmail message object.
     * @returns The updated Gmail message object with the applied categorisation label.
     */
    public async categoriseEmail(email: Email): Promise<Email> {
        const existingLabels = email.labels || [];
        const hasCategorisedLabel = existingLabels.some(label => LabelFactory.isValidLabel(label));
        if (hasCategorisedLabel) {
            this.logger.info("Email is already categorised.");
            return email;
        }

        // Create a categoriser instance using the factory and pass the extracted email details.
        const categoriser = container.resolve<ICategoriser>('ICategoriser');

        // const email = emailAdaptor.adapt(gmailEmailMessage);
        const categorisation = await categoriser.categoriseEmail(email);
        this.logger.info("Categorisation result:", categorisation);

        await this.emailClient.categoriseEmail(
            {
                email: email,
                label: LabelFactory.getLabel(categorisation.label)
            }
        );

        return email;
    }

    async fetchLastEmails(count: number) {
        return await this.emailClient.fetchLastEmails(count);
    }

    public async listenForIncomingEmails(): Promise<void> {
        if (this.emailClient instanceof GmailClient) {
            await this.emailClient.listenForIncomingEmails();
        } else {
            this.logger.error("Email client is not a GmailClient");
            throw new BadClientError("Email client is not a GmailClient");
        }
    }

    // TODO: Challenge task, draw out a system diagram for this project (10 minutes and explain why you have included each component and what you would do if you had more time)
    // 1. Feature requirements:
    // 1. App must be able to start and start the mail_manager singleton which manages the mail_listeners and mail_observers. MailListeners use the gmail_client to listen for gmail. MailObservers subscribe to topics on the event store.
    // 2. App must be able to fetch the last 10 emails from the inbox.
    // 3. App must be able to add handlers (subscribers / observers) in a manner that is loosely coupled for handliong events from the stream of type new_email_received.
    // 4. One of the handlers should categorise the email.
    // 6. The app should have loosely coupled logger using dependency injection provded by inversify.
    // The component that handles labelling should be loosely coupled from the component that decided which label to apply.
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

