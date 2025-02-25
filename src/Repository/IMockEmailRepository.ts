import { IAmEmailService } from "../EmailService/IAmEmailService";
import { Email } from "../models/Email";
import { IRepository } from "./IRepository";


export interface IMockEmailRepository extends IRepository {
    saveEmails(emails: {email: Email, service?: IAmEmailService}[]): Promise<void>;
    getEmails(): Promise<Email[]>;
}