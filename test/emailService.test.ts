import { EmailService } from "../src/EmailService/EmailService";
import type { IEmailClient } from "../src/Repository/IEmailClient";
import type { Email } from "../src/models/Email";
import { CategoriserFactory } from "../src/Categoriser/LLMCategoriser";
import { LabelFactory } from "../src/models/Label";

// Mock the CategoriserFactory to provide a fake categoriser.
jest.mock("../src/Categoriser/LLMCategoriser", () => ({
    CategoriserFactory: {
        createCategoriser: () => ({
            categoriseEmail: jest.fn().mockResolvedValue({ label: "mock-label" })
        })
    }
}));

// Spy on LabelFactory methods and extend their doc strings
jest.spyOn(LabelFactory, "isValidLabel").mockImplementation((label: string) => label === "existing-categorised");
jest.spyOn(LabelFactory, "getLabel").mockImplementation((label: any) => label);

describe("EmailService", () => {
    let mockEmailClient: IEmailClient;
    let emailService: EmailService;

    beforeEach(() => {
        mockEmailClient = {
            listenForIncomingEmails: jest.fn().mockResolvedValue(undefined),
            fetchLastEmails: jest.fn().mockResolvedValue([]),
            categoriseEmail: jest.fn().mockResolvedValue({ id: "1", labels: [] })
        };
        emailService = new EmailService(mockEmailClient);
    });

    test("should return email without categorising if already categorised", async () => {
        const email: Email = {
            messageId: "1",
            threadId: "thread-1",
            subject: "Test Subject",
            body: "Test Body",
            sender: "sender@example.com",
            recipients: ["recipient@example.com"],
            bccRecipients: [],
            ccRecipients: [],
            timestamp: new Date(),
            labels: ["existing-categorised"],
            attachments: [],
            location: "INBOX"
        };
        const result = await emailService.categoriseEmail(email);
        expect(result).toEqual(email);
        expect(mockEmailClient.categoriseEmail).not.toHaveBeenCalled();
    });

    test("should categorise email if not already categorised", async () => {
        const email: Email = {
            messageId: "2",
            threadId: "thread-2",
            subject: "Another Test Subject",
            body: "Another Test Body",
            sender: "sender2@example.com",
            recipients: ["recipient2@example.com"],
            bccRecipients: [],
            ccRecipients: [],
            timestamp: new Date(),
            labels: [],
            attachments: [],
            location: "INBOX"
        };
        const result = await emailService.categoriseEmail(email);
        expect(result).toEqual(email);
        expect(mockEmailClient.categoriseEmail).toHaveBeenCalledWith({
            email,
            label: "mock-label"
        });
    });
}); 