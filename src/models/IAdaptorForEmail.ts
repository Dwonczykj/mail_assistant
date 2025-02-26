import { Email } from "./Email";

export interface IEmailAdaptor<T> {
    adapt(email: T): Email;
    validate(email: T): boolean;
    readonly messages: string[];
}