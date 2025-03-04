import { Email } from "../models/Email";
import { IEmailCategorisation } from "./IEmailCategorisation";

export interface ICategoriser {
    categoriseEmail(email: Email): Promise<IEmailCategorisation>;

    /**
     * Determines if an email requires a response based on the logistic regressor model.
     * @param email - The email to categorise.
     * @returns A promise containing the result of the categorisation where requiresResponse is true if the email requires a response, false otherwise and confidence is the probability of the email requiring a response.
     */
    emailRequiresResponse(email: Email): Promise<{
        requiresResponse: boolean;
        reason: string;
        confidence: number;
    }>;
}
