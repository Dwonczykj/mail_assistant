import { Email } from "./Email";
import { IAdaptorForEmails } from "./IAdaptorForEmail";
import { gmail_v1 } from "googleapis";


export class GmailAdaptor implements IAdaptorForEmails<gmail_v1.Schema$Message> {
    public readonly messages: string[] = [];
    adapt(email: gmail_v1.Schema$Message): Email {
        // Extract email details required for categorisation.
        const threadId = email.threadId || "";
        const headers = email.payload?.headers || [];
        const subject = headers.find(header => header.name?.toLowerCase() === 'subject')?.value || "No Subject";
        const from = headers.find(header => header.name?.toLowerCase() === 'from')?.value || "Unknown Sender";
        // Using the snippet as a simple representation of the body. Attachments are excluded.
        const body = email.snippet || "";
        const timestamp = email.internalDate ? new Date(parseInt(email.internalDate)) : new Date();
        const timestampString = timestamp.toISOString();
        return {
            subject,
            sender: from,
            body,
            timestamp: timestamp,
            threadId: email.threadId || "",
            messageId: email.id || "",
            labels: email.labelIds || [],
            attachments: email.payload?.parts?.map(part => ({
                id: part.body?.attachmentId || "",
                filename: part.filename || "",
                content: part.body?.data || "",
                filehash: part.body?.attachmentId || ""
            })) || [],
            location: "",
            recipients: [],
            bccRecipients: [],
            ccRecipients: []
        }
    };

    public validate = (email: gmail_v1.Schema$Message): boolean => {
        let valid = true;
        if (!email.id) {
            this.messages.push(`GmailAdaptor.validate: No id for email: ${JSON.stringify(email)}`);
            valid = false;
        }
        if (!email.threadId) {
            this.messages.push(`GmailAdaptor.validate: No threadId for email: ${JSON.stringify(email)}`);
            valid = false;
        }
        if (!email.internalDate) {
            this.messages.push(`GmailAdaptor.validate: No internalDate for email: ${JSON.stringify(email)}`);
            valid = false;
        }
        if (!email.payload?.headers || email.payload?.headers.length === 0) {
            this.messages.push(`GmailAdaptor.validate: No headers for email: ${JSON.stringify(email)}`);
            valid = false;
        }
        return valid;
    };
}
