import { EmailServiceManager } from "./EmailService/EmailServiceManager";



export const initServices = async () => {
    const emailServiceManager = EmailServiceManager.getInstance();
    await emailServiceManager.addEmailService("gmail");

    return {
        emailServiceManager: EmailServiceManager.getInstance(),
    };
};