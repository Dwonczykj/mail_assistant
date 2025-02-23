import { Email } from "../models/Email";
import { IRepository } from "./IRepository";


export interface IMockEmailRepository extends IRepository {
    saveEmails(emails: Email[]): Promise<void>;
    getEmails(): Promise<Email[]>;
}