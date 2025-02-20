import { Email } from "./Email";

export interface IAdaptorForEmails<T> {
    adapt(email: T): Email;
}