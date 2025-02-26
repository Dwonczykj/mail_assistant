import { ICategoriser } from "./ICategoriser";
import { Email } from "../models/Email";
import { IEmailCategorisation } from "./IEmailCategorisation";

export class DummyCategoriser implements ICategoriser {
    private static labels = [
        "Primary",
        "Work",
        "Personal",
        "Social",
        "Spam",
        "Updates",
        "Promotions",
        "Other"
    ];
    constructor() { }

    async categoriseEmail(email: Email): Promise<IEmailCategorisation> {
        // console.log the subject,sender,timestamp and then first 30 characters of the email body 
        console.log(`Subject: ${email.subject}`);
        console.log(`Sender: ${email.sender}`);
        console.log(`Timestamp: ${email.timestamp}`);
        console.log(`Body: ${email.body.substring(0, 30)}`);
        console.log(`--------------------------------`);
        // Randomly categorise the email using one of the categories from the repository layer.
        const randomCategory = DummyCategoriser.labels[Math.floor(Math.random() * DummyCategoriser.labels.length)];
        email.labels.push(randomCategory);
        return { label: randomCategory };
    }

    async emailRequiresResponse(email: Email): Promise<{
        requiresResponse: boolean;
        reason: string;
        confidence: number;
    }> {
        return { requiresResponse: false, reason: "Dummy categoriser", confidence: 0 };
    }
}
