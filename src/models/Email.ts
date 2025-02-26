export class Email {
    readonly messageId!: string;
    readonly threadId!: string;
    readonly subject!: string;
    readonly body!: string;
    readonly sender!: string;
    readonly recipients!: string[];
    readonly bccRecipients!: string[];
    readonly ccRecipients!: string[];
    readonly timestamp!: Date;
    labels!: string[];
    readonly attachments!: Attachment[];
    location!: string;
    readonly snippet?: string | null;
    readonly historyId?: string;
    readonly internalDate?: string;
    readonly headers?: Record<string, string>;
}

export class Attachment {
    readonly id!: string;
    readonly filename!: string;
    readonly content!: string;
    readonly filehash!: string;
}