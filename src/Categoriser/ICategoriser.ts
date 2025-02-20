import { Email } from "../models/Email";
import { IEmailCategorisation } from "./IEmailCategorisation";

interface ICategoriser {
    categoriseEmail(email: Email): Promise<IEmailCategorisation>;
}

export default ICategoriser;

