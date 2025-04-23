import { Message, PrismaClient } from '@/infrastructure/database/prisma-client'
import { getTokenCount, checkEnoughBalance } from '../tokens/tokens';
import { getIO } from '@/infrastructure/socket/server';
import { recognizeIntent } from '@/core/intent/intentRecognition';
import { LLMMessage, LLMRole, createLLMService } from '@/core/llm/factory';
import { encrypt, decrypt } from '@/common/utils/encrypt';
import { log } from '@/common/utils/log';
import * as memoryService from '@/core/memory/memory';
import { IMemory } from '@/core/memory/memory';
import { chains } from '@/core/networks/chains';
import { ASSISTANT_CONFIG } from '@/config/assistant.config';
import { streamResponse } from '@/core/stream/stream';
import { updateStatus } from '@/infrastructure/socket/handlers';
import { IStreamResponse } from '@/core/stream/stream';
import { updateState, emitStreamResponse } from '@/core/stream/stream';

const prisma = new PrismaClient();

export interface CreateMessageParams {
    userId: string;
    chatId: string;
    content: string;
    role?: string;
    isInitialChat?: boolean;
}

interface Transaction {
    id: string;
    hash: string | null;
    status: string;
    type: string;
    data: string;
    chainId: number;
    userId: string;
    messageId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface IMessage {
    id: string;
    content: string;
    toolData?: string | null;
    role: string;
    chatId: string;
    userId: string;
    chat?: {
        id: string;
        title: string;
        userId: string;
    };
    user?: {
        id: string;
        address: string;
    };
    transaction?: Transaction | null;
    createdAt: Date;
    updatedAt: Date;
}

async function processMessage(userId: string, messageId: string, chatId: string, content: string, chainId: number = 1): Promise<string> {
    let userSettings: any = null;
    let messages: LLMMessage[] = [];
    let currentStep = 'initialization';
    
    try {
        currentStep = 'loading_user_settings';
        userSettings = await prisma.userSettings.findUnique({
            where: { userId }
        }) || await prisma.userSettings.create({
            data: { userId }
        });

        currentStep = 'intent_recognition';
        const intent = await recognizeIntent(content, userId, messageId, chatId);
        const hasTools = intent.tools && intent.tools.length > 0;
        
        try {
            await updateStatus(chatId, 'Lunark is thinking...');
        } catch (error) {}

        currentStep = 'loading_memories';
        const shortTermMemories = await memoryService.recall({
            userId,
            chatId,
            type: 'SHORT_TERM'
        });

        const longTermMemories = await memoryService.recall({
            userId,
            chatId,
            type: 'LONG_TERM',
            minImportance: 0.7
        });

        currentStep = 'preparing_llm';
        const llmService = await createLLMService(userSettings?.llmModel || ASSISTANT_CONFIG.MODELS.CHAT);
        
        currentStep = 'loading_chat_history';
        const chatHistory = await prisma.message.findMany({
            where: { chatId },
            orderBy: { createdAt: 'asc' },
            select: {
                content: true,
                role: true
            }
        });

        messages = chatHistory.map(msg => ({
            role: msg.role === 'lunark' ? 'assistant' : msg.role as LLMRole,
            content: decrypt(msg.content)
        }));

        currentStep = 'preparing_message_data';
        const messageData: any = {
            chatId,
            userId,
            chainId,
            role: 'lunark',
            chat: await prisma.chat.findUnique({
                where: { id: chatId },
                select: {
                    id: true,
                    title: true,
                    userId: true
                }
            }) || undefined,
            user: await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    address: true
                }
            }) || undefined
        };

        currentStep = 'generating_response';
        if (hasTools) {
            try {
                await updateStatus(chatId, 'Lunark is processing your request...');
            } catch (error) {}
        }

        const systemPrompt = `You are Lunark, an AI assistant and agent specializing in blockchain operations.

                Current Context:
                - User's Wallet Address: ${messageData?.user?.address || 'Not Connected'}
                - User id: ${userId}
                - Current Connected Network: ${chains[chainId]?.name ? chains[chainId]?.name : 'Ethereum'} (Chain ID: ${chainId})
                - Always use exact amount as specified by user (no decimal modifications)
                - If no wallet address is specified, use the connected wallet address.
                - If no chain ID or network name is specified, use the current network.
                - When calling tools that accept a context parameter, ALWAYS pass the following context:
                  {
                    userId: "${userId}",
                    userAddress: "${messageData?.user?.address || ''}"
                  }
                - Always prioritize and execute the user's current request with the latest provided address, chain or data, regardless of chat history or memory context
                - For phrases like "as well", "also", "too" - ONLY execute the new request, DO NOT repeat previous operations

                Supported Networks:
                    ${Object.values(chains).map(chain => `- ${chain.name} (Chain ID: ${chain.chainId})`).join('\n')} 

                Available Tools:
                    ${intent.tools?.map(tool => 
                        `${tool.definition.function.name}: ${tool.definition.function.description}`
                    ).join('\n\n')}

                Memory Context:
                - Short-term Memory (Chat Summary):
                    ${shortTermMemories.map((m: IMemory) => `- ${m.content}`).join('\n')}

                - Long-term Memory (Important Historical Context):
                    ${longTermMemories.map((m: IMemory) => `- ${m.content}`).join('\n')}
            `;

        const responseStream = await llmService.generateResponse(messages, {
            model: userSettings?.llmModel || ASSISTANT_CONFIG.MODELS.CHAT,
            temperature: 0.7,
            maxTokens: 4096,
            tools: intent.tools,
            systemPrompt: systemPrompt,
            defaultWallet: messageData?.user?.address,
            defaultChainId: chainId,
            stream: !intent.hasNewTools
        });

        let result: string;
        
        currentStep = 'streaming_response';

        // Initialize empty result
        result = '';

        // Save initial message to database
        const dbMessageData: any = {
            content: encrypt(result),
            role: 'lunark',
            chat: { connect: { id: chatId } },
            user: { connect: { id: userId } }
        };

        const message = await prisma.message.create({
            data: dbMessageData
        });

        // Update messageData with messageId
        messageData.messageId = message.id;

        // Continue stream response with updated messageData
        result = await streamResponse(
            chatId,
            {
                userId,
                chainId,
                hasTools,
                userAddress: messageData?.user?.address
            },
            responseStream,
            messageData
        );

        return result;

    } catch (error) {
        try {
            const errorMessage = 'I encountered an error while processing your request. Please try again.';
            
            // Create error message
            const errorDbMessage = await prisma.message.create({
                data: {
                    content: encrypt(''),  // Start with empty content
                    role: 'lunark',
                    chat: { connect: { id: chatId } },
                    user: { connect: { id: userId } }
                }
            });
            
            // Stream the error message
            await emitStreamResponse(chatId, {
                chatId,
                messageId: errorDbMessage.id,
                userId,
                success: false,
                message: errorMessage,
                role: 'lunark'
            });

            // Update message with error content
            await prisma.message.update({
                where: { id: errorDbMessage.id },
                data: { content: encrypt(errorMessage) }
            });

            // Emit stream end
            const io = getIO();
            io.to(chatId).emit('streamEnd', {
                chatId,
                isComplete: false,
                error: error instanceof Error ? error.message : 'An unknown error occurred'
            });
        } catch (socketError) {}

        // Only delete the last short-term memory on error
        const lastMemory = await prisma.memory.findFirst({
            where: {
                chatId,
                type: 'SHORT_TERM'
            },
            orderBy: {
                timestamp: 'desc'
            }
        });

        if (lastMemory) {
            await prisma.memory.delete({
                where: { id: lastMemory.id }
            });
        }

        throw error;
    }
}

export async function createMessage(
    chatId: string,
    userId: string,
    role: string,
    content: string,
    chainId: number = 1,
    shouldProcess: boolean = true,
    isInitialChat: boolean = false
): Promise<Message> {
    try {
        // Validate chain ID
        if (!chains[chainId]) {
            throw new Error(`Invalid chain ID: ${chainId}`);
        }

        // Check user balance
        const userSettings = await prisma.userSettings.findUnique({
            where: { userId }
        });

        const model = userSettings?.llmModel || ASSISTANT_CONFIG.MODELS.CHAT;
        const tokens = getTokenCount(content, model);
        const hasEnoughBalance = await checkEnoughBalance(userId, tokens, model, true);

        if (!hasEnoughBalance) {
            throw new Error('Insufficient balance');
        }

        // Create and save the message
        const message = await prisma.message.create({
            data: {
                content: encrypt(content),
                role,
                chat: { connect: { id: chatId } },
                user: { connect: { id: userId } }
            }
        });

        // Process message if needed
        if (role === 'user' && shouldProcess) {
            processMessage(userId, message.id, chatId, content, chainId);
        }

        return message;
    } catch (error) {
        throw error;
    }
}

export const messageService = {
    createMessage
};