import { openaiService } from './openai';
import { Tool } from '../tools/tools';

export type LLMRole = 'user' | 'lunark' | 'assistant' | 'system';

export interface LLMMessage {
    role: LLMRole;
    content: string;
}

export interface LLMToolParameter {
    type: string;
    description?: string;
    required?: boolean;
    enum?: string[];
    items?: {
        type: string;
        properties?: Record<string, LLMToolParameter>;
    };
    properties?: Record<string, LLMToolParameter>;
}

export interface LLMToolCall {
    function: {
        name: string;
        arguments: string;
        description?: string;
        parameters?: {
            type: string;
            properties: Record<string, LLMToolParameter>;
            required?: string[];
        };
    };
}

export interface LLMResponse {
    content: string;
    hasContent: boolean;
    contentLength: number;
    toolCalls: any[];
    hasToolCalls: boolean;
}

export interface LLMConfig {
    model: string;
    temperature?: number;
    maxTokens?: number;
    chatId?: string;
    apiKey?: string;
    tools?: Tool[];
    systemPrompt?: string;
    stopSequences?: string[];
    topP?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
    defaultWallet?: string;
    defaultChainId?: number;
    stream?: boolean;
}

export function convertRoleForAPI(role: LLMRole): string {
    return role === 'lunark' ? 'assistant' : role;
}

export interface LLMService {
    generateResponse(messages: LLMMessage[], config: LLMConfig): AsyncGenerator<LLMResponse>;
    countTokens(text: string): number;
}

export async function createLLMService(_model: string): Promise<LLMService> {
    return openaiService;
}

export const llmFactory = {
    createLLMService
}; 