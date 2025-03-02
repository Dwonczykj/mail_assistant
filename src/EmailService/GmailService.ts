import { IGoogleAuth } from "../lib/utils/IGoogleAuth";
import { Inject, Injectable } from "@nestjs/common";
import { GmailClient } from "../Repository/GmailClient";
import { ILogger } from "../lib/logger/ILogger";
import { EmailService } from "./EmailService";
import { ICategoriser } from "../Categoriser/ICategoriser";
import { IMailListener } from "./IMailListener";
import { GmailAdaptor } from "../models/GmailAdaptor";
import { IEmailAdaptor } from "../models/IAdaptorForEmail";
import { gmail_v1 } from "googleapis";
@Injectable()
export class GmailService extends EmailService<gmail_v1.Schema$Message> {
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

    public getEmailAdaptor(): IEmailAdaptor<gmail_v1.Schema$Message> {
        return new GmailAdaptor();
    }
}