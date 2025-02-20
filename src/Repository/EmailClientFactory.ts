import { GmailClient } from "./GmailClient";
import { IEmailClient } from "./IEmailClient";
import type { gmail_v1 } from 'googleapis';

export class EmailClientFactory {
    static async getGmailClient(): Promise<IEmailClient> {
        return await GmailClient.getInstance({});
    }
}