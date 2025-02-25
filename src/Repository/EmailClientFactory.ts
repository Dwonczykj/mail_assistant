import { GmailClient } from "./GmailClient";
import { IEmailClient } from "./IEmailClient";
import { container } from "../container";
import { IGoogleAuth } from "../lib/utils/IGoogleAuth";

export class EmailClientFactory {
    static async getGmailClient({
        googleAuthInitialiser,
    }: {
        googleAuthInitialiser: IGoogleAuth
    }): Promise<IEmailClient> {
        return await GmailClient.getTemporaryInstance({ authProvider: googleAuthInitialiser });
    }
}