import { Email } from "../models/Email";

export interface IAmEmailService {
    name: string;
    fetchLastEmails(count: number): Promise<Email[]>;
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

    listenForIncomingEmails(): Promise<void>;
}