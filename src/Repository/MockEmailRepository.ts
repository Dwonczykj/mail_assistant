import { ILogger } from "../lib/logger/ILogger";
import { Email } from "../models/Email";
import { IMockEmailRepository } from "./IMockEmailRepository";
import { IAmEmailService } from "../EmailService/IAmEmailService";
import { Injectable, Inject } from "@nestjs/common";

@Injectable()
export class MockEmailRepository implements IMockEmailRepository {

    // private readonly logger: ILogger;

    constructor(
        @Inject('ILogger') private readonly logger: ILogger
    ) { }

    async saveEmails(emails: { email: Email, service?: IAmEmailService }[]): Promise<void> {
        const fss = require('fs');
        const fs = require('fs').promises;
        const path = require('path');

        const mockEmailsFilePath = path.join(__dirname, '..', '..', 'test', 'mocks', 'mock_emails.json');

        // Create the file if it doesn't exist
        if (!fss.existsSync(mockEmailsFilePath)) {
            await fs.writeFile(mockEmailsFilePath, '[]');
        }

        // Read existing emails or create an empty array
        let existingEmails = [];
        try {
            const data = await fs.readFile(mockEmailsFilePath, 'utf8');
            existingEmails = JSON.parse(data);
        } catch (error) {
            this.logger.error('Error reading mock emails file:', { error: error });
        }

        // Append new emails with service names to the existing array
        existingEmails.push(...emails.map(emailServiceTuple => ({ email: emailServiceTuple.email, service: emailServiceTuple.service?.name })));

        // Write the updated array back to the file
        await fs.writeFile(mockEmailsFilePath, JSON.stringify(existingEmails, null, 2));
        this.logger.info(`Saved ${emails.length} emails to ${mockEmailsFilePath}`);
    }

    async getEmails(): Promise<Email[]> {
        const fss = require('fs');
        const fs = require('fs').promises;
        const path = require('path');

        const mockEmailsFilePath = path.join(__dirname, '..', '..', 'test', 'mocks', 'mock_emails.json');

        // Read the file
        const data = await fs.readFile(mockEmailsFilePath, 'utf8');
        return JSON.parse(data);
    }

    async logFyxerAction(action: string, data: any): Promise<void> {
        // LOG any fyxer action to a an append only csv file in ./test/mocks/mock_fyxer_actions.csv
        const fss = require('fs');
        const fs = require('fs').promises;
        const path = require('path');

        const mockFyxerActionsFilePath = path.join(__dirname, '..', '..', 'test', 'mocks', 'mock_fyxer_actions.csv');

        // Create the file if it doesn't exist
        if (!fss.existsSync(mockFyxerActionsFilePath)) {
            await fs.writeFile(mockFyxerActionsFilePath, 'action,data\n');
        }

        // Append the new action to the file
        await fs.appendFile(mockFyxerActionsFilePath, `${action},${data}\n`);
        this.logger.info(`Logged FyxerBot action: ${action}, ${data}`);
    }

}
