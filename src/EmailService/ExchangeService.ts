import { IGoogleAuth } from "../lib/utils/IGoogleAuth";
import { Inject, Injectable } from "@nestjs/common";
import { GmailClient } from "../Repository/GmailClient";
import { ILogger } from "../lib/logger/ILogger";
import { EmailService } from "./EmailService";
import { ICategoriser } from "../Categoriser/ICategoriser";
import { IMailListener } from "./IMailListener";
import { IEmailAdaptor } from "../models/IAdaptorForEmail";
// import { gmail_v1 } from "googleapis"; // TODO: replace this exchange api package if there is one
import { ExchangeClient } from "../Repository/ExchangeClient";
import { ExchangeAdaptor } from "../models/ExchangeAdaptor";
@Injectable()
export class ExchangeService extends EmailService<any> {
    readonly name: string = "exchange";

    constructor(
        @Inject("ICategoriser") categoriser: ICategoriser,
        @Inject("ILogger") logger: ILogger,
        @Inject("ExchangeClient") exchangeClient: ExchangeClient,
        @Inject("ExchangeListenerService") readonly listenerService: IMailListener,
    ) {
        super(
            exchangeClient,
            logger,
            categoriser,
        );
    }

    public getEmailAdaptor(): IEmailAdaptor<any> {
        return new ExchangeAdaptor();
    }
}
