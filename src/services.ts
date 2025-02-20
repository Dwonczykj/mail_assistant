import { EmailServiceManager } from "./EmailService/EmailServiceManager";
import { GmailClient } from "./Repository/GmailClient";



export const initServices = async () => {
    const emailServiceManager = EmailServiceManager.getInstance();
    await emailServiceManager.addEmailService("gmail");

    return {
        emailServiceManager: EmailServiceManager.getInstance(),
    };
};