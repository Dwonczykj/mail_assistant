import { ChatOpenAI } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage } from "@langchain/core/messages";
import ICategoriser from "./ICategoriser";
import { Email } from "../models/Email";
import { IEmailCategorisation } from "./IEmailCategorisation";
import { EmailCategorisation } from "./EmailCategorisation";



/**
 * Interface for structured email data containing details for categorisation.
 */
export interface IEmailData {
    subject: string;
    from: string;
    body: string;
    timestamp: string;
}

export class LLMCategoriser implements ICategoriser {
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

    constructor(private llm: BaseChatModel) {
        // Existing constructor logic
    }

    /**
     * Categorises an email based on its detailed information such as subject, sender, body and timestamp.
     * @param email - The structured email data for categorisation.
     * @returns The email categorisation result containing label, confidence and reason.
     * @throws Will throw an error if the subject, sender, body, or timestamp is empty.
     */
    async categoriseEmail(email: Email): Promise<IEmailCategorisation> {
        // NEW: Validate required fields.
        if (!email.subject) {
            throw new Error("Email subject is empty");
        }
        if (!email.sender) {
            throw new Error("Email sender is empty");
        }
        if (!email.body) {
            throw new Error("Email body is empty");
        }
        if (!email.timestamp) {
            throw new Error("Email timestamp is empty");
        }

        // Compose email details for the prompt.
        const emailDetails = `Subject: ${email.subject}
From: ${email.sender}
Body: ${email.body}
Timestamp: ${email.timestamp}`;
        const labels = LLMCategoriser.labels;
        // Updated prompt including detailed email information excluding attachments.
        const prompt = `
You are a helpful assistant that categorises emails into one of the following labels:
${labels.join(", ")}
Based on the following email details (excluding attachments):
${emailDetails}
`;
        const response = await this.llm.withStructuredOutput(EmailCategorisation).invoke([new HumanMessage(prompt)]);
        return response.content;
    }
}

export class CategoriserFactory {
    /**
     * Creates an instance of an ICategoriser using the ChatOpenAI model.
     * @returns An instance of LLMCategoriser.
     */
    static createCategoriser(): LLMCategoriser {
        const llm = new ChatOpenAI({
            model: "gpt-4o-mini",
            temperature: 0,
        });
        return new LLMCategoriser(llm);
    }
}

