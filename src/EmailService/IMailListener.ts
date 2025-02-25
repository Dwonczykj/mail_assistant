import { OAuth2Client } from "google-auth-library";

export interface IMailListener {
    start(): void;
    stop(): void;
    authenticate({ oAuthClient }: { oAuthClient: OAuth2Client }): Promise<void>;
}