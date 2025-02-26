import { Email } from './Email';
import { IAdaptorForEmails } from './IAdaptorForEmail';

/**
 * Adapts Microsoft Exchange email format to our internal Email model
 */
export class ExchangeAdaptor implements IAdaptorForEmails<any> {
    public readonly messages: string[] = [];
    /**
     * Adapts a Microsoft Exchange email message to our internal Email model
     * @param exchangeMessage - The Exchange email message
     * @returns An Email object with the data from the Exchange message
     */
    public adapt = (exchangeMessage: any): Email => {
        // Extract headers from Exchange message
        const headers = this.extractHeaders(exchangeMessage);

        // Extract email parts
        const subject = exchangeMessage.subject || '';
        const from = this.extractSender(exchangeMessage);
        const to = this.extractRecipients(exchangeMessage);
        const body = this.extractBody(exchangeMessage);
        const date = new Date(exchangeMessage.receivedDateTime || Date.now());

        // Create Email object
        return {
            messageId: exchangeMessage.id,
            threadId: exchangeMessage.conversationId,
            labels: this.extractLabels(exchangeMessage),
            snippet: exchangeMessage.bodyPreview || '',
            historyId: '',
            internalDate: date.getTime().toString(),

            // Email details
            subject,
            sender: from,
            recipients: to,
            ccRecipients: this.extractCcRecipients(exchangeMessage),
            bccRecipients: [],
            timestamp: date,
            body,
            attachments: this.extractAttachments(exchangeMessage),
            headers,
            location: exchangeMessage.webLink,
        };
    };

    public validate = (exchangeMessage: any): boolean => {
        let valid = true;
        if (!exchangeMessage.id) {
            this.messages.push(`ExchangeAdaptor.validate: No id for email: ${JSON.stringify(exchangeMessage)}`);
            valid = false;
        }
        if (!exchangeMessage.conversationId) {
            this.messages.push(`ExchangeAdaptor.validate: No conversationId for email: ${JSON.stringify(exchangeMessage)}`);
            valid = false;
        }
        if (!exchangeMessage.subject) {
            this.messages.push(`ExchangeAdaptor.validate: No subject for email: ${JSON.stringify(exchangeMessage)}`);
            valid = false;
        }
        if (!exchangeMessage.from?.emailAddress?.address) {
            this.messages.push(`ExchangeAdaptor.validate: No from address for email: ${JSON.stringify(exchangeMessage)}`);
            valid = false;
        }
        if (!exchangeMessage.toRecipients || !Array.isArray(exchangeMessage.toRecipients)) {
            this.messages.push(`ExchangeAdaptor.validate: No to recipients for email: ${JSON.stringify(exchangeMessage)}`);
            valid = false;
        }
        if (!exchangeMessage.receivedDateTime) {
            this.messages.push(`ExchangeAdaptor.validate: No received date time for email: ${JSON.stringify(exchangeMessage)}`);
            valid = false;
        }
        return valid;
    };

    /**
     * Extracts email headers from Exchange message
     */
    private extractHeaders(exchangeMessage: any): Record<string, string> {
        const headers: Record<string, string> = {};

        // In a real implementation, this would extract internet headers from the Exchange message
        // Example: exchangeMessage.internetMessageHeaders.forEach(h => headers[h.name] = h.value);

        // Add basic headers
        headers['subject'] = exchangeMessage.subject || '';
        headers['from'] = exchangeMessage.from?.emailAddress?.address || '';
        headers['to'] = exchangeMessage.toRecipients?.map((r: any) => r.emailAddress.address).join(', ') || '';
        headers['date'] = exchangeMessage.receivedDateTime || '';

        return headers;
    }

    /**
     * Extracts sender information from Exchange message
     */
    private extractSender(exchangeMessage: any): string {
        if (exchangeMessage.from?.emailAddress) {
            const name = exchangeMessage.from.emailAddress.name || '';
            const email = exchangeMessage.from.emailAddress.address || '';
            return name ? `${name} <${email}>` : email;
        }
        return '';
    }

    /**
     * Extracts recipient information from Exchange message
     */
    private extractRecipients(exchangeMessage: any): string[] {
        if (!exchangeMessage.toRecipients || !Array.isArray(exchangeMessage.toRecipients)) {
            return [];
        }

        return exchangeMessage.toRecipients.map((recipient: any) => {
            const name = recipient.emailAddress?.name || '';
            const email = recipient.emailAddress?.address || '';
            return name ? `${name} <${email}>` : email;
        });
    }

    /**
     * Extracts CC recipient information from Exchange message
     */
    private extractCcRecipients(exchangeMessage: any): string[] {
        if (!exchangeMessage.ccRecipients || !Array.isArray(exchangeMessage.ccRecipients)) {
            return [];
        }

        return exchangeMessage.ccRecipients.map((recipient: any) => {
            const name = recipient.emailAddress?.name || '';
            const email = recipient.emailAddress?.address || '';
            return name ? `${name} <${email}>` : email;
        });
    }

    /**
     * Extracts email body from Exchange message
     */
    private extractBody(exchangeMessage: any): string {
        // Prefer HTML content if available
        if (exchangeMessage.body?.contentType === 'html') {
            return exchangeMessage.body.content || '';
        }

        // Fall back to text content
        return exchangeMessage.body?.content || exchangeMessage.bodyPreview || '';
    }

    /**
     * Extracts attachments from Exchange message
     */
    private extractAttachments(exchangeMessage: any): any[] {
        if (!exchangeMessage.attachments || !Array.isArray(exchangeMessage.attachments)) {
            return [];
        }

        return exchangeMessage.attachments.map((attachment: any) => ({
            filename: attachment.name,
            contentType: attachment.contentType,
            size: attachment.size,
            attachmentId: attachment.id
        }));
    }

    /**
     * Extracts labels/categories from Exchange message
     */
    private extractLabels(exchangeMessage: any): string[] {
        // In Exchange, these would be categories or folder information
        return exchangeMessage.categories || [];
    }
} 