import { OpenAI } from 'openai';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import { LLMService, LLMConfig, LLMMessage, LLMResponse, convertRoleForAPI } from './factory';
import { getTokenCount } from '../tokens/tokens';
import { log } from '@/common/utils/log';
import { Tool } from '../tools/tools';

let client: OpenAI | null = null;

function initializeClient() {
    if (!client) {
        client = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: process.env.OPENAI_API_KEY
        });
    }
    return client;
}

interface ToolCallBuffer {
    index: number;
    id: string;
    type: string;
    function: {
        name: string;
        arguments: string;
    };
    isComplete: boolean;
}

async function* generateResponse(messages: LLMMessage[], config: LLMConfig): AsyncGenerator<LLMResponse> {
    try {
        const openai = initializeClient();

        const systemMessage = config.systemPrompt ? {
            role: 'system' as const,
            content: `${config.systemPrompt}\n\nWhen using tools, always include these default values unless explicitly specified otherwise:\n- wallet: ${config.defaultWallet || ''}\n- chainId: ${config.defaultChainId || 1}`
        } : null;

        const formattedMessages = [
            ...(systemMessage ? [systemMessage] : []),
            ...messages.map(msg => ({
                role: convertRoleForAPI(msg.role) as 'assistant' | 'user' | 'system',
                content: msg.content
            }))
        ];

        const hasTools = config.tools && config.tools.length > 0;
        const completion = await openai.chat.completions.create({
            model: config.model,
            messages: formattedMessages,
            temperature: config.temperature,
            max_tokens: config.maxTokens,
            stream: config.stream,
            ...(hasTools ? {
                tools: config.tools!.map(tool => ({
                    type: 'function' as const,
                    function: {
                        name: tool.name,
                        description: tool.definition.function.description,
                        parameters: tool.definition.function.parameters
                    }
                })),
                tool_choice: 'auto'
            } : {})
        });

        if (config.stream) {
            let currentContent = '';
            let shouldEmit = false;

            try {
                const stream = completion as AsyncIterable<ChatCompletionChunk>;
                
                for await (const part of stream) {
                    const content = part.choices[0]?.delta?.content || '';
                    if (content) {
                        currentContent += content;
                        shouldEmit = true;
                    }

                    if (shouldEmit && currentContent.length >= 50) {
                        try {
                            yield {
                                content: currentContent,
                                hasContent: currentContent.length > 0,
                                contentLength: currentContent.length,
                                hasToolCalls: false,
                                toolCalls: []
                            };
                        } catch (emitError) {}
                        currentContent = '';
                        shouldEmit = false;
                    }
                }

                if (currentContent) {
                    try {
                        yield {
                            content: currentContent,
                            hasContent: currentContent.length > 0,
                            contentLength: currentContent.length,
                            hasToolCalls: false,
                            toolCalls: []
                        };
                    } catch (emitError) {}
                }
            } catch (streamError) {
                if (currentContent) {
                    yield {
                        content: currentContent,
                        hasContent: currentContent.length > 0,
                        contentLength: currentContent.length,
                        hasToolCalls: false,
                        toolCalls: []
                    };
                }
            }
        } else {
            const response = completion as OpenAI.Chat.Completions.ChatCompletion;
            const content = response.choices[0]?.message?.content || '';
            const toolCalls = response.choices[0]?.message?.tool_calls || [];
            
            try {
                yield {
                    content,
                    hasContent: content.length > 0,
                    contentLength: content.length,
                    hasToolCalls: toolCalls.length > 0,
                    toolCalls: toolCalls.map(tc => ({
                        id: tc.id,
                        type: tc.type,
                        function: {
                            name: tc.function.name,
                            arguments: tc.function.arguments
                        }
                    }))
                };
            } catch (emitError) {
                if (!(emitError instanceof Error && emitError.message.includes('socket'))) {
                    throw emitError;
                }
            }
        }
    } catch (error) {
        throw error;
    }
}

function countTokens(text: string): number {
    return getTokenCount(text);
}

export const openaiService: LLMService = {
    generateResponse,
    countTokens
}; 