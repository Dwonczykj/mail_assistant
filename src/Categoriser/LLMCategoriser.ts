import { ChatOpenAI } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { LLM, type BaseLLMParams } from "@langchain/core/language_models/llms";
import { HumanMessage } from "@langchain/core/messages";
import { ICategoriser } from "./ICategoriser";
import { Email } from "../models/Email";
import { IEmailCategorisation } from "./IEmailCategorisation";
import { EmailCategorisation } from "./EmailCategorisation";
import { StructuredOutputParser } from "langchain/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { Injectable, Inject } from "@nestjs/common";
import { ILogger } from "../lib/logger/ILogger";
import { LABELS } from "../models/Label";


/**
 * Interface for structured email data containing details for categorisation.
 */
export interface IEmailData {
    subject: string;
    from: string;
    body: string;
    timestamp: string;
}

@Injectable()
export class LLMCategoriser implements ICategoriser {
    private static labelDescriptionTuples = LABELS;

    constructor(private llm: BaseChatModel | LLM, @Inject("ILogger") private logger: ILogger) {
        // Existing constructor logic
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

    /**
     * Categorises an email based on its detailed information such as subject, sender, body and timestamp.
     * @param email - The structured email data for categorisation.
     * @returns The email categorisation result containing label, confidence and reason.
     * @throws Will throw an error if the subject, sender, body, or timestamp is empty.
     */
    async categoriseEmail(email: Email): Promise<IEmailCategorisation> {
        // NEW: Validate required fields.
        if (!email.subject) {
            throw new Error("Email subject is empty");
        }
        if (!email.sender) {
            throw new Error("Email sender is empty");
        }
        if (!email.body) {
            throw new Error("Email body is empty");
        }
        if (!email.timestamp) {
            throw new Error("Email timestamp is empty");
        }

        // Define the parser
        const parser = StructuredOutputParser.fromZodSchema(
            z.object({
                label: z.enum(LLMCategoriser.labelDescriptionTuples.map(t => t.name) as [string, ...string[]]),
                labelConfidence: z.number(),
                reason: z.string()
            } as { [key in keyof IEmailCategorisation]: z.ZodType<IEmailCategorisation[key]> })
        );

        // Get the format instructions
        const formatInstructions = parser.getFormatInstructions();

        // Compose email details for the prompt
        const emailDetails = `Subject: ${email.subject}
From: ${email.sender}
Body: ${email.body}
Timestamp: ${email.timestamp}`;

        // Create a formatted prompt
        const prompt = new PromptTemplate({
            template: `You are a helpful assistant that categorises emails.
Based on the following email details (excluding attachments):
{emailDetails}

Categorize this email into one of the following labels:
{labels}

{format_instructions}

Provide your response:`,
            inputVariables: ["emailDetails", "labels"],
            partialVariables: {
                format_instructions: formatInstructions
            }
        });

        const formattedPrompt = await prompt.format({
            emailDetails: emailDetails,
            labels: LLMCategoriser.labelDescriptionTuples.map(t => `{label: ${t.name}, description: ${t.description}}`).join(", ")
        });

        if (this.llm instanceof BaseChatModel) {
            // Bind the schema to the model
            const modelWithStructure = this.llm.withStructuredOutput<IEmailCategorisation>(parser);
            // Invoke the model
            const structuredOutput = await modelWithStructure.invoke(
                formattedPrompt
            );

            // Get back the object
            this.logger.info(`${structuredOutput.label} with confidence ${structuredOutput.labelConfidence} and reason ${structuredOutput.reason}`);
            if (structuredOutput && ((structuredOutput.labelConfidence ?? 0) < 0 || (structuredOutput.labelConfidence ?? 0) > 1)) {
                this.logger.warn("Label confidence is out of range");
                structuredOutput.labelConfidence = 0.5;
            }

            return structuredOutput;
            // { answer: "The powerhouse of the cell is the mitochondrion. Mitochondria are organelles that generate most of the cell's supply of adenosine triphosphate (ATP), which is used as a source of chemical energy.", followup_question: "What is the function of ATP in the cell?" }
            // const schema = {
            //     type: "object",
            //     properties: {
            //         label: {
            //             type: "string",
            //             enum: LLMCategoriser.labels
            //         },
            //         labelConfidence: {
            //             type: "number",
            //             minimum: 0,
            //             maximum: 1
            //         },
            //         reason: {
            //             type: "string"
            //         }
            //     },
            //     required: ["label", "labelConfidence", "reason"]
            // };

            // const response = await this.llm.invoke([new HumanMessage(formattedPrompt)], {
            //     response_format: { type: "json_object", schema: schema }
            // });

            // try {
            //     const content = JSON.parse(response.content);
            //     return {
            //         label: content.label,
            //         labelConfidence: content.labelConfidence,
            //         reason: content.reason
            //     };
            // } catch (error) {
            //     console.error("Failed to parse ChatModel response:", error);
            //     return {
            //         label: "Other",
            //         labelConfidence: 0.5,
            //         reason: "Failed to parse JSON response from LLM"
            //     };
            // }
        } else {
            const response = await this.llm.invoke(formattedPrompt);
            try {
                const parsedResponse = await parser.parse(response);
                return {
                    label: parsedResponse.label,
                    labelConfidence: parsedResponse.labelConfidence as number,
                    reason: parsedResponse.reason as string
                };
            } catch (error) {
                console.error("Failed to parse LLM response:", error);
                // Fallback response if parsing fails
                return {
                    label: "Other",
                    labelConfidence: 0.5,
                    reason: "Failed to parse structured response from LLM"
                };
            }
        }
    }

    private async parseOllamaResponse(response: string): Promise<IEmailCategorisation> {
        try {
            // First try parsing as JSON
            if (response.includes('{') && response.includes('}')) {
                const jsonStr = response.substring(
                    response.indexOf('{'),
                    response.lastIndexOf('}') + 1
                );
                const parsed = JSON.parse(jsonStr);
                if (parsed.label && parsed.confidence && parsed.reason) {
                    return {
                        label: parsed.label,
                        labelConfidence: parsed.confidence,
                        reason: parsed.reason
                    };
                }
            }

            // Fallback: Basic text parsing
            const lines = response.split('\n');
            const label = LLMCategoriser.labelDescriptionTuples.find(t =>
                response.toLowerCase().includes(t.name.toLowerCase())
            )?.name || "Other";

            return {
                label,
                labelConfidence: 0.7, // Default confidence
                reason: response.slice(0, 200) // Use first 200 chars as reason
            };
        } catch (error) {
            console.error("Failed to parse Ollama response:", error);
            return {
                label: "Other",
                labelConfidence: 0.5,
                reason: "Failed to parse response"
            };
        }
    }
}
