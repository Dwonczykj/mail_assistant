import { ICategoriser } from "../Categoriser/ICategoriser";
import { Email } from "../models/Email";
import { LabelFactory } from "../models/Label";
import { IEmailClient } from "../Repository/IEmailClient";
import { IAmEmailService } from "./IAmEmailService";
import { ILogger } from "../lib/logger/ILogger";
import { Injectable, Inject } from "@nestjs/common";
import { IMailListener } from "./IMailListener";
import { IReceiveOAuthClient } from "../lib/utils/IGoogleAuth";
import { OAuth2Client } from "google-auth-library";

@Injectable()
export abstract class EmailService implements IAmEmailService {
    abstract readonly name: string;
    abstract readonly listenerService: IMailListener;

    constructor(
        @Inject("IEmailClient") private readonly emailClient: IEmailClient,
        @Inject("ILogger") private readonly logger: ILogger,
        @Inject("ICategoriser") private readonly categoriser: ICategoriser,
    ) { }

    public async authenticate({ oAuthClient }: { oAuthClient: OAuth2Client }): Promise<void> {
        await this.emailClient.authenticate({ oAuthClient });
        await this.listenerService.authenticate({ oAuthClient });
    }

    public get authenticated(): Promise<boolean> {
        return this.emailClient.authenticated;
    }

    /**
     * Categorises an email if not already labelled.
     * It extracts the subject, sender, snippet for body and timestamp from the Gmail message,
     * then passes these details to the LLMCategoriser for a categorisation label.
     * Finally, it updates the email on Gmail with the new label.
     * @param gmail_message - A Gmail message object.
     * @returns The updated Gmail message object with the applied categorisation label.
     */
    public async categoriseEmail(email: Email): Promise<Email> {
        const existingLabels = email.labels || [];
        const hasCategorisedLabel = existingLabels.some(label => LabelFactory.isValidLabel(label));
        if (hasCategorisedLabel) {
            this.logger.info("Email is already categorised.");
            return email;
        }

        const categorisation = await this.categoriser.categoriseEmail(email);
        this.logger.info("Categorisation result:", categorisation);

        await this.emailClient.categoriseEmail(
            {
                email: email,
                label: LabelFactory.getLabel(categorisation.label)
            }
        );

        return email;
    }

    async fetchLastEmails({
        count,
        lastNHours
    }: {
        count: number,
        lastNHours?: number
    }) {
        return await this.emailClient.fetchLastEmails({ count, lastNHours });
    }
}

