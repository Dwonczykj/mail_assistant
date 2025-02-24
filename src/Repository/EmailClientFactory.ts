import { GmailClient } from "./GmailClient";
import { IEmailClient } from "./IEmailClient";
import { container } from "../container";
import { IGmailAuth } from "../lib/utils/IGmailAuth";

export class EmailClientFactory {
    static async getGmailClient(): Promise<IEmailClient> {
        const googleAuthInitialiser = container.resolve<IGmailAuth>('IGmailAuth');
        return await GmailClient.getTemporaryInstance({ authProvider: googleAuthInitialiser });
    }
}