import { Email } from "../models/Email";
import { ILabel } from "../models/Label";

/**
 * Interface representing an email client.
 * @param T - The type of the email object.
 */
export interface IEmailClient {
    readonly name: string;
    

    /**
     * Starts listening for incoming emails through Gmail push notifications.
     */
    listenForIncomingEmails(): Promise<void>;

    /**
     * Fetches the last N emails from the Gmail server.
     * @param count - Number of emails to fetch.
     * @returns Array of Gmail message objects.
     */
    fetchLastEmails({
        count,
        lastNHours
    }: {
        count: number,
        lastNHours?: number
    }): Promise<Email[]>;

    /**
     * Categorises an email if not already labelled.
     * If the email is not already categorised, it extracts the email's subject, sender,
     * body and timestamp (excluding attachments) and passes it to the LLMCategoriser.
     * @param email - A Gmail message object.
     * @returns The updated Gmail message object with the categorisation label applied.
     */
    categoriseEmail(
        { email, label }:
            { email: Email, label: ILabel }): Promise<Email>;
}