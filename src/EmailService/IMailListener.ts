import { OAuth2Client } from "google-auth-library";

export interface IMailListener {
    start({processEmailCallback}: {processEmailCallback: (email: Email) => Promise<void>}): Promise<void>;
    stop(): void;
    authenticate({ oAuthClient }: { oAuthClient: OAuth2Client }): Promise<void>;
    isActive(): boolean;
}