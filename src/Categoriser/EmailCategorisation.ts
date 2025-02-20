/**
 * Represents the categorisation result for an email.
 */
export class EmailCategorisation {
    /**
     * The label that the email has been categorised into.
     */
    label!: string;
    /**
     * The confidence in the categorisation as a percentage.
     */
    labelConfidence!: number;
    /**
     * The reason for the categorisation.
     */
    reason!: string;
}