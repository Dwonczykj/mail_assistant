import { IGoogleAuth } from "../lib/utils/IGoogleAuth";
import { Inject, Injectable } from "@nestjs/common";
import { GmailClient } from "../Repository/GmailClient";
import { ILogger } from "../lib/logger/ILogger";
import { EmailService } from "./EmailService";
import { ICategoriser } from "../Categoriser/ICategoriser";
import { GmailListenerService } from "./GmailListener";
import { IMailListener } from "./IMailListener";

@Injectable()
export class GmailService extends EmailService {
    readonly name: string = "gmail";

    constructor(
        @Inject("ICategoriser") categoriser: ICategoriser,
        @Inject("ILogger") logger: ILogger,
        @Inject("GmailClient") gmailClient: GmailClient,
        @Inject("GmailListenerService") readonly listenerService: IMailListener,
    ) {
        super(
            gmailClient,
            logger,
            categoriser,
        );
    }
}