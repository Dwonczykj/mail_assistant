import { Email } from "../models/Email";
import { IMailListener } from "./IMailListener";
import { IReceiveOAuthClient } from "../lib/utils/IGoogleAuth";
import { IEmailAdaptor } from "../models/IAdaptorForEmail";

export interface IAmEmailService extends IReceiveOAuthClient {
    readonly name: string;
    readonly listenerService: IMailListener;

    getEmailAdaptor(): IEmailAdaptor<any>;
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