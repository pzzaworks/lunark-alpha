import { LLMMessage, createLLMService } from '@/core/llm/factory';
import { tools, Tool } from '@/core/tools';
import { log } from '@/common/utils/log';
import * as memory from '@/core/memory/memory';
import prisma from '@/infrastructure/database/prisma';
import { ASSISTANT_CONFIG } from '@/config/assistant.config';
import { calculateCost, getTokenCount, updateUsage } from '../tokens/tokens';

type ToolIntent = keyof typeof tools;
type CommonIntent = 'UNKNOWN';
export type IntentType = ToolIntent | CommonIntent;

interface Message {
    content: string;
}

interface ToolUsage {
    name: string;
    lastUsed: string;
    useCount: number;
    lastArguments?: any;
}

export interface RecognizedIntent {
    type: IntentType;
    details: {
        [key: string]: any;
    };
    confidence: number;
    tools: Tool[];
    hasNewTools: boolean;
    chainName?: string;
    chainId?: number;
}

export function createIntentError(code: string, message: string): Error {
    const error = new Error(message);
    error.name = 'IntentError';
    (error as any).code = code;
    return error;
}

export async function recognizeIntent(message: string, userId: string, messageId: string, chatId: string): Promise<RecognizedIntent> {
    try {
        const chat = await prisma.chat.findUnique({
            where: { id: chatId },
            select: { tools: true }
        });

        const previousTools: ToolUsage[] = chat?.tools ? JSON.parse(chat.tools) : [];

        const shortTermMemories = await memory.recall({
            userId,
            chatId,
            type: 'SHORT_TERM'
        });

        const availableTools = tools as Tool[];
        const toolDefinitions = availableTools.map(tool => ({
            name: tool.definition.function.name,
            instructions: tool.instructions,
            definition: tool.definition
        }));

        const userSettings = await prisma.userSettings.findUnique({
            where: {
                userId: userId
            }
        });

        const llmService = await createLLMService(userSettings?.llmModel || ASSISTANT_CONFIG.MODELS.CHAT);
        
        const systemPrompt = `You are Lunark, an AI assistant and agent that recognizes user intents for blockchain operations. Your task is to analyze user messages and identify which blockchain tools are needed for their requests.

                        Your response should be a simple text listing the required tools if there are any.

                        Example response formats:
                        "Required tools sequence:
                        1. get_balance - Check wallet balance
                        2. resolve_token - Get token details"

                        Previously used tools in this chat:
                        ${previousTools.map((tool) => 
                            `- ${tool.name} (used ${tool.useCount} times, last used: ${new Date(tool.lastUsed).toLocaleString()})`
                        ).join('\n')}

                        Available Tools:
                        ${toolDefinitions
                            .map(tool => `- ${tool.name}: ${tool.instructions}`)
                            .join('\n')}

                        Chat Summary:
                        ${shortTermMemories.map((msg: Message) => msg.content).join('\n')}`;

        const messages: LLMMessage[] = [
            {
                role: 'user',
                content: message
            }
        ];

        const responseGenerator = llmService.generateResponse(messages, {
            model: userSettings?.llmModel || ASSISTANT_CONFIG.MODELS.CHAT,
            temperature: userSettings?.temperature || 0.1,
            systemPrompt
        });

        let content = '';
        for await (const chunk of responseGenerator) {
            if (chunk.hasContent) {
                content += chunk.content;
            }
        }

        if (!content) {
            throw createIntentError('NO_RESPONSE', 'No response from intent recognition');
        }

        const inputTokenCount = getTokenCount(message, userSettings?.llmModel || ASSISTANT_CONFIG.MODELS.CHAT);
        const intentTokenCount = getTokenCount(content, userSettings?.llmModel || ASSISTANT_CONFIG.MODELS.CHAT);
        const intentCost = calculateCost(inputTokenCount, intentTokenCount, userSettings?.llmModel || ASSISTANT_CONFIG.MODELS.CHAT);
        const intentCostBreakdown = {
            type: 'intent',
            promptTokens: inputTokenCount,
            completionTokens: intentTokenCount,
            cost: intentCost
        };

        await updateUsage(userId, chatId, messageId, inputTokenCount, intentTokenCount, intentCost, JSON.stringify(intentCostBreakdown));
        
        const matchedTools = availableTools
            .filter(tool => content.toLowerCase().includes(tool.definition.function.name.toLowerCase()));

        if (matchedTools.length === 0 && previousTools.length > 0) {
            matchedTools.push(...availableTools.filter(tool => 
                previousTools.some(pt => pt.name === tool.definition.function.name)
            ));
        }

        const allTools = [...matchedTools];

        if (matchedTools.length === 0) {
            return {
                type: 'UNKNOWN',
                details: {},
                confidence: 1,
                tools: [],
                hasNewTools: false,
                chainName: 'Ethereum',
                chainId: 1
            };
        }

        const uniqueTools = allTools.filter((tool, index, self) =>
            index === self.findIndex((t) => t.definition.function.name === tool.definition.function.name)
        );

        const hasNewTools = matchedTools.length > 0;

        const updatedTools = previousTools.map(pt => ({
            ...pt,
            useCount: uniqueTools.some(ut => ut.definition.function.name === pt.name) 
                ? pt.useCount + 1 
                : pt.useCount,
            lastUsed: uniqueTools.some(ut => ut.definition.function.name === pt.name)
                ? new Date().toISOString()
                : pt.lastUsed
        }));

        uniqueTools.forEach(tool => {
            if (!updatedTools.some(ut => ut.name === tool.definition.function.name)) {
                updatedTools.push({
                    name: tool.definition.function.name,
                    lastUsed: new Date().toISOString(),
                    useCount: 1
                });
            }
        });

        await prisma.chat.update({
            where: { id: chatId },
            data: { tools: JSON.stringify(updatedTools) }
        });

        return {
            type: matchedTools[0].name as IntentType,
            details: {},
            confidence: 1,
            tools: uniqueTools,
            hasNewTools,
            chainName: 'Ethereum',
            chainId: 1
        };

    } catch (error: any) {
        throw createIntentError('RECOGNITION_FAILED', `Failed to recognize intent: ${error.message}`);
    }
} 