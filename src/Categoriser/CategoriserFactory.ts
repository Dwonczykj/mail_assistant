import { ChatOpenAI } from "@langchain/openai";
import { ChatVertexAI } from "@langchain/google-vertexai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatAnthropic } from "@langchain/anthropic";
import { Ollama } from "@langchain/ollama";
import { ICategoriser } from "./ICategoriser";
import { LLMCategoriser } from "./LLMCategoriser";
import { config } from "../Config/config";
import { ILogger } from "../lib/logger/ILogger";
import { container } from "../container";

export class CategoriserFactory {
    private static logger = () => container.resolve<ILogger>("ILogger");
    /**
     * Creates an instance of an ICategoriser using the ChatOpenAI model.
     * @returns An instance of ICategoriser.
     */
    static createCategoriserOpenAI(): ICategoriser {

        const llm = new ChatOpenAI({
            model: "gpt-4o",
            temperature: 0,
            apiKey: config.apiKeys.openai,
        });
        return new LLMCategoriser(llm, this.logger());
    }

    static createCategoriserOpenRouter({
        model = "gpt-4o",
        temperature = 0,
    }: {
        model?: string;
        temperature?: number;
    }): ICategoriser {

        const llm = new ChatOpenAI({
            model: model, // or deepseek....
            temperature: temperature,
            apiKey: config.apiKeys.openrouter,
            configuration: {
                baseURL: config.openrouter.apiUrl,
            }
        });
        return new LLMCategoriser(llm, this.logger());
    }

    static createCategoriserGemini({
        model = "gemini-1.5-flash",
        temperature = 0,
    }: {
        model?: string;
        temperature?: number;
    }): ICategoriser {

        const llm = new ChatGoogleGenerativeAI({
            model: model,
            temperature: temperature,
            apiKey: config.apiKeys.gemini,
        });
        return new LLMCategoriser(llm, this.logger());

    }
    static createCategoriserVertexAI({
        model = "gemini-1.5-flash",
        temperature = 0,
    }: {
        model?: string;
        temperature?: number;
    }): ICategoriser {
        const vertexAiWebCredentials = JSON.parse(`${config.apiKeys.vertexaiWebCreds}`);
        const llm = new ChatVertexAI({
            model: model,
            temperature: temperature,
        });
        return new LLMCategoriser(llm, this.logger());
    }

    static createCategoriserAnthropic({
        model = "claude-3-5-sonnet",
        temperature = 0,
    }: {
        model?: string;
        temperature?: number;
    }): ICategoriser {

        const llm = new ChatAnthropic({
            model: model,
            temperature: temperature,
            apiKey: config.apiKeys.anthropic,
        });
        return new LLMCategoriser(llm, this.logger());
    }

    static createCategoriserOllama(): ICategoriser {

        const llm = new Ollama({
            baseUrl: "http://localhost:11434", // TODO: Is this correct?
            model: "mistral:latest",
            temperature: 0,
        });
        return new LLMCategoriser(llm, this.logger());
    }
}

