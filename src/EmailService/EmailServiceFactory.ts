import { ILogger } from "../lib/logger/ILogger";
import { GmailClient } from "../Repository/GmailClient";
import { EmailService } from "./EmailService";
import { IAmEmailService } from "./IAmEmailService";
import { container } from "../container";


export class EmailServiceFactory {
    static async createEmailService(serviceName: string): Promise<IAmEmailService> {
        const logger = container.resolve<ILogger>("ILogger");
        if (serviceName === "gmail") {
            const gmailClient = await GmailClient.getInstance({});
            return new EmailService(gmailClient, "gmail", logger);
        }
        throw new Error(`Unknown email service: ${serviceName}`);
    }
}

