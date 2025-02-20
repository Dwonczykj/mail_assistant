import { GmailClient } from "../Repository/GmailClient";
import { EmailService } from "./EmailService";
import { IAmEmailService } from "./IAmEmailService";


export class EmailServiceFactory {
    static async createEmailService(serviceName: string): Promise<IAmEmailService> {
        if (serviceName === "gmail") {
            const gmailClient = await GmailClient.getInstance({});
            return new EmailService(gmailClient, "gmail");
        }
        throw new Error(`Unknown email service: ${serviceName}`);
    }
}

