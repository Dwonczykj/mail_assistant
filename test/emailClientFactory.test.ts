import { EmailClientFactory } from "../src/Repository/EmailClientFactory";
import type { IEmailClient } from "../src/Repository/IEmailClient";
import { generateMockEmails } from "./mocks/mockEmail";

// Ensure that `mockEmailClient` is declared before it's used in the jest.mock call
const mockEmailClient = {
    listenForIncomingEmails: jest.fn().mockResolvedValue(undefined),
    fetchLastEmails: jest.fn().mockResolvedValue(generateMockEmails({ count: 10 })),
    categoriseEmail: jest.fn().mockResolvedValue(generateMockEmails({ count: 1 })[0]),
};

// Mock the GmailClient module to return our mock email client.
jest.mock("../src/Repository/GmailClient", () => ({
    GmailClient: {
        getInstance: jest.fn().mockImplementation(() => Promise.resolve(mockEmailClient))
    }
}));

describe('EmailClientFactory', () => {
    test('getGmailClient returns a client that can fetch last 10 emails', async () => {
        const client = await EmailClientFactory.getGmailClient();
        const emails = await client.fetchLastEmails(10);

        // Ensure that fetchLastEmails is called with an argument of 10.
        expect(client.fetchLastEmails).toHaveBeenCalledWith(10);
        // Verify that the returned emails array has 10 items.
        expect(emails).toHaveLength(10);
        // Removed console.log call. If logging is needed, consider injecting ILogger.
        
    });
}); 