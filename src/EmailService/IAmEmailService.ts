import { Email } from "../models/Email";
import { IMailListener } from "./IMailListener";
import { IEmailAdaptor } from "../models/IAdaptorForEmail";

/**
 * Represents an email service that can categorise and archive emails.
 * @template TProviderEmail - The type of email object provided by the email service i.e. Gmail, Exchange, etc. gmail currently uses gmail_v1.Schema$Message
 */
export interface IAmEmailService<TProviderEmail extends any> {
    readonly name: string;
    readonly listenerService: IMailListener;

    getEmailAdaptor(): IEmailAdaptor<TProviderEmail>;
    fetchLastEmails({ count, lastNHours }: { count: number, lastNHours?: number }): Promise<Email[]>;
    categoriseEmail(email: Email): Promise<Email>;

    // // Draft Email
    // draftEmail(email: Email): Promise<Email>;

    // // Read Email
    // readEmail(email: Email): Promise<Email>;

    // // Email Received
    // emailReceived(email: Email): Promise<Email>;

    // // Email Sent
    // emailSent(email: Email): Promise<Email>;

    // // Email Opened
    // emailOpened(email: Email): Promise<Email>;

    // // Email Clicked
    // emailClicked(email: Email): Promise<Email>;

    // emailCategorisedEvent;

    // emailArchivedEvent;

    // categoriseEmail(email: Email): Promise<Email>;

    // archiveEmail(email: Email): Promise<Email>;
}