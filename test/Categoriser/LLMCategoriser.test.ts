import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { LLMCategoriser } from "../../src/Categoriser/LLMCategoriser";
import { Email } from "../../src/models/Email";

// Define a fake LLM to simulate responses.
const fakeLLM: jest.Mocked<Partial<BaseChatModel> & {
    withStructuredOutput: jest.Mock;
    invoke: jest.Mock;
}> = {
    // Mimic the chaining of withStructuredOutput().invoke()
    withStructuredOutput: jest.fn().mockReturnThis(),
    invoke: jest.fn().mockResolvedValue({
        content: {
            label: "Work",
            confidence: 1,
            reason: "Based on email data",
        },
    }),
};

describe("LLMCategoriser", () => {
    let categoriser: LLMCategoriser;

    beforeEach(() => {
        // Reset the fake LLM function calls and create a new instance.
        fakeLLM.withStructuredOutput.mockClear();
        fakeLLM.invoke.mockClear();
        categoriser = new LLMCategoriser(fakeLLM);
    });

    it("should categorise a valid email correctly", async () => {
        const email: Email = {
            messageId: "1",
            threadId: "1",
            subject: "Test Subject",
            body: "Test body",
            sender: "test@example.com",
            recipients: ["recipient@example.com"],
            bccRecipients: [],
            ccRecipients: [],
            timestamp: new Date(),
            labels: [],
            attachments: [],
            location: "INBOX",
        };

        const result = await categoriser.categoriseEmail(email);
        expect(fakeLLM.withStructuredOutput).toHaveBeenCalled();
        expect(fakeLLM.invoke).toHaveBeenCalled();
        // Verify the fake response was returned.
        expect(result.label).toEqual("Work");
        expect(result.labelConfidence).toEqual(1);
        expect(result.reason).toBeDefined();
    });

    it("should throw an error if email subject is empty", async () => {
        const email: Email = {
            messageId: "2",
            threadId: "2",
            subject: "",
            body: "Test body",
            sender: "test@example.com",
            recipients: ["recipient@example.com"],
            bccRecipients: [],
            ccRecipients: [],
            timestamp: new Date(),
            labels: [],
            attachments: [],
            location: "INBOX",
        };

        await expect(categoriser.categoriseEmail(email)).rejects.toThrow("Email subject is empty");
    });

    it("should throw an error if email sender is empty", async () => {
        const email: Email = {
            messageId: "3",
            threadId: "3",
            subject: "Test Subject",
            body: "Test body",
            sender: "",
            recipients: ["recipient@example.com"],
            bccRecipients: [],
            ccRecipients: [],
            timestamp: new Date(),
            labels: [],
            attachments: [],
            location: "INBOX",
        };

        await expect(categoriser.categoriseEmail(email)).rejects.toThrow("Email sender is empty");
    });

    it("should throw an error if email body is empty", async () => {
        const email: Email = {
            messageId: "4",
            threadId: "4",
            subject: "Test Subject",
            body: "",
            sender: "test@example.com",
            recipients: ["recipient@example.com"],
            bccRecipients: [],
            ccRecipients: [],
            timestamp: new Date(),
            labels: [],
            attachments: [],
            location: "INBOX",
        };

        await expect(categoriser.categoriseEmail(email)).rejects.toThrow("Email body is empty");
    });

    it("should throw an error if email timestamp is empty", async () => {
        // For testing purposes, we can simulate a missing timestamp by setting it to null.
        const email: Email = {
            messageId: "5",
            threadId: "5",
            subject: "Test Subject",
            body: "Test body",
            sender: "test@example.com",
            recipients: ["recipient@example.com"],
            bccRecipients: [],
            ccRecipients: [],
            timestamp: null as unknown as Date,
            labels: [],
            attachments: [],
            location: "INBOX",
        };

        await expect(categoriser.categoriseEmail(email)).rejects.toThrow("Email timestamp is empty");
    });
}); 