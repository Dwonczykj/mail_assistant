import { IAmEmailService } from "../../src/EmailService/IAmEmailService";
import { Email } from "../../src/models/Email";
import { faker } from "@faker-js/faker";
import { GmailAdaptor } from "../../src/models/GmailAdaptor";

export const mockGmailService: IAmEmailService<any> = {
    name: "Gmail",
    listenerService: new GmailListenerService(),    
    fetchLastEmails: async () => [],
    categoriseEmail: async () => new Email(),
    fetchLastEmails: async () => [],
    getEmailAdaptor: () => new GmailAdaptor()
}

export function generateMockEmails({
    count = 1
}: {
    count?: number
}): { email: Email, service?: IAmEmailService<any> }[] {
    // TODO Use a mocking framework to assign random values to the properties.
    return Array.from({ length: count || 1 }, () => ({
        messageId: faker.string.uuid(),
        threadId: faker.string.uuid(),
        subject: faker.lorem.sentence(),
        body: faker.lorem.paragraph(),
        sender: faker.internet.email(),
        recipients: [faker.internet.email()],
        bccRecipients: [],
        ccRecipients: [],
        timestamp: faker.date.recent(),
        labels: [],
        attachments: [],
        location: "INBOX"
    })).map(email => ({ email, service: mockGmailService }));
}