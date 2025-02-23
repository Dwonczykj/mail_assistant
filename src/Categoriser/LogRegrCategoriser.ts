import { Email } from "../models/Email";
import { ICategoriser } from "./ICategoriser";
import { IEmailCategorisation } from "./IEmailCategorisation";



export class LogRegrCategoriser implements ICategoriser {
    constructor(private logisticRegressorML: any) {
        // TODO: Use the Hugging Face Transformers API to connect to a collection of ML transformer models for each different method below. i.e. Create a map of the different models so that they can be easily called from the methods below.
    }
    categoriseEmail(email: Email): Promise<IEmailCategorisation> {
        throw new Error("Method not implemented.");
    }

    /**
     * Determines if an email requires a response based on the logistic regressor model.
     * @param email - The email to categorise.
     * @returns A promise containing the result of the categorisation where requiresResponse is true if the email requires a response, false otherwise and confidence is the probability of the email requiring a response.
     */
    emailRequiresResponse(email: Email): Promise<{
        requiresResponse: boolean;
        reason: string;
        confidence: number;
    }> {
        throw new Error("Method not implemented.");
    }
}
