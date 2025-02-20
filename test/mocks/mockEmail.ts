import { Email } from "../../src/models/Email";
import { faker } from "@faker-js/faker";

export function generateMockEmails({
    count = 1
}: {
    count?: number
}): Email[] {
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
    }));
}