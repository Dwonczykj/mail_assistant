import { IMailListener } from "./IMailListener";


export class GmailListener implements IMailListener {
    constructor() {

    }
    start(): void {
        throw new Error("Method not implemented.");
    }
    stop(): void {
        throw new Error("Method not implemented.");
    }


}