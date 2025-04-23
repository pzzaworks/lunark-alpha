import { Server } from 'socket.io';
import { getIO } from '@/infrastructure/socket/server';
import { log } from '@/common/utils/log';
import { handleToolCalls, ToolCall } from '@/core/tools/tools';
import prisma from '@/infrastructure/database/prisma';
import { encrypt, decrypt } from '@/common/utils/encrypt';
import * as memoryService from '@/core/memory/memory';
import { createLLMService, LLMMessage } from '@/core/llm/factory';
import { ASSISTANT_CONFIG } from '@/config/assistant.config';

export interface StreamState {
    messageId: string | null;
    userId: string;
    lastMessageId: string | null;
    pendingMessageContent: string;
    lastChunk: any | null;
    chunks: any[];
    isStreaming: boolean;
    reconnectAttempts: number;
    lastActive: Date;
    hasTxTool: boolean;
    hasToolData: boolean;
    hasMemories: boolean;
    toolResults: any[];
    transactions: {
        id: string;
        hash: string | null;
        status: string;
        type: string;
        data: any;
        chainId: number;
        userId: string;
        messageId: string;
        createdAt: Date;
        updatedAt: Date;
    }[];
    chainId: number;
    userAddress?: string;
    isInitialChat?: boolean;
    hasTools: boolean;
    pendingTransactionData?: string;
}

export interface IStreamResponse {
    chatId: string;
    messageId?: string;
    userId?: string;
    success: boolean;
    message?: string;
    toolData?: any;
    transaction?: any;
    role?: string;
    chainId?: number;
    memories?: any[];
    chat?: {
        id: string;
        title: string;
        userId: string;
    };
    user?: {
        id: string;
        address: string;
    };
}

// Global state store - Map of chatId to StreamState
const streamStates = new Map<string, StreamState>();

// Thread-safe state operations
export const initializeState = (chatId: string, initialState: Partial<StreamState> = {}): StreamState => {
    const state: StreamState = {
        messageId: null,
        userId: initialState.userId || '',
        lastMessageId: null,
        pendingMessageContent: '',
        lastChunk: null,
        chunks: [],
        isStreaming: true,
        reconnectAttempts: 0,
        lastActive: new Date(),
        hasTxTool: false,
        hasToolData: false,
        hasMemories: false,
        toolResults: [],
        transactions: [],
        chainId: initialState.chainId || 1,
        hasTools: initialState.hasTools || false,
        userAddress: initialState.userAddress
    };

    streamStates.set(chatId, state);
    return state;
};

export const updateState = (chatId: string, updates: Partial<StreamState>): StreamState => {
    const currentState = streamStates.get(chatId);
    
    // If no current state or new message, initialize fresh state
    if (!currentState || (updates.messageId && updates.messageId !== currentState.messageId)) {
        return initializeState(chatId, {
            ...updates,
            isStreaming: true,
            pendingMessageContent: '',
            chunks: [],
            lastChunk: null,
            toolResults: [],
            transactions: [],
            hasTxTool: false,
            hasToolData: false,
            hasMemories: false
        });
    }
    
    // Update existing state
    const newState = {
        ...currentState,
        ...updates,
        lastActive: new Date()
    };
    
    streamStates.set(chatId, newState);
    return newState;
};

export const getState = (chatId: string): StreamState | undefined => {
    // Atomic operation to get state
    return streamStates.get(chatId);
};

export const cleanup = (chatId: string): void => {
    const state = getState(chatId);
    if (!state) {
        return;
    }

    if (state.isInitialChat) {
        return;
    }
    
    // Atomic operation to delete state
    streamStates.delete(chatId);
};

// Socket.io emit functions
export const socketEmit = {
    streamResponse: (chatId: string, response: Partial<IStreamResponse>): Promise<void> => {
        const io = getIO();
        return new Promise<void>((resolve) => {
            io.to(chatId).emit('streamResponse', {
                ...response,
                chatId,
                timestamp: new Date().toISOString()
            }, () => {
                resolve();
            });
        });
    },

    status: (chatId: string, status: string): Promise<void> => {
        const io = getIO();
        return new Promise<void>((resolve) => {
            io.to(chatId).emit('streamStatus', { status }, () => {
                resolve();
            });
        });
    },

    error: (chatId: string, error: Error | string): Promise<void> => {
        const io = getIO();
        return new Promise<void>((resolve) => {
            io.to(chatId).emit('error', {
                chatId,
                error: error instanceof Error ? error.message : error,
                timestamp: new Date().toISOString()
            }, () => {
                resolve();
            });
        });
    },

    streamEnd: (chatId: string): Promise<void> => {
        const io = getIO();
        return new Promise<void>((resolve) => {
            io.to(chatId).emit('streamEnd', {
                chatId,
                timestamp: new Date().toISOString()
            }, () => {
                resolve();
            });
        });
    }
};

// Use socketEmit instead of individual emit functions
export const emitStreamResponse = socketEmit.streamResponse;
export const emitStatus = socketEmit.status;
export const emitError = socketEmit.error;
export const emitStreamEnd = socketEmit.streamEnd;

// Update interfaces at the top
export interface IRawToolCall {
    id?: string;
    function?: {
        name?: string;
        arguments?: string;
    };
}

export interface IToolCall {
    id: string;
    function: {
        name: string;
        arguments: string;
    };
}

export interface ICurrentToolCall {
    id: string;
    index: number;
    function: {
        name: string;
        arguments: string;
    };
    isComplete: boolean;
}

export interface IStreamChunk {
    toolCalls?: IRawToolCall[];
    choices?: Array<{
        delta: {
            content?: string;
            toolCalls?: IRawToolCall[];
        };
    }>;
    content?: string;
}

// Add type guard function
function isToolCall(value: unknown): value is IToolCall {
    if (!value || typeof value !== 'object') return false;
    
    const candidate = value as Record<string, unknown>;
    if (!candidate.id || !candidate.function || typeof candidate.function !== 'object') return false;
    
    const func = candidate.function as Record<string, unknown>;
    return typeof func.name === 'string' && typeof func.arguments === 'string';
}

export const streamResponse = async (
    chatId: string,
    initialState: any,
    responseStream: AsyncGenerator<any>,
    messageData: Partial<IStreamResponse>
): Promise<string> => {
    let state = getState(chatId);
    let result = '';
    let currentToolCall: ICurrentToolCall | null = null;
    let isAborted = false;

    try {
        // Set up stream abort handler
        const io = getIO();
        const sockets = await io.in(chatId).fetchSockets();
        
        // Subscribe to streamAborted events
        const abortHandler = () => {
            isAborted = true;
        };

        // Add handler to each socket in the room
        for (const socket of sockets) {
            socket.data.abortHandler = abortHandler;
        }
        
        // Reset streaming state for new messages
        if (state?.messageId !== messageData.messageId) {
            state = initializeState(chatId, {
                ...initialState,
                messageId: messageData.messageId,
                isStreaming: true,
                lastActive: new Date(),
                toolResults: [],
                transactions: []
            });
        } else if (!state) {
            state = initializeState(chatId, {
                ...initialState,
                messageId: messageData.messageId,
                isStreaming: true,
                lastActive: new Date(),
                toolResults: [],
                transactions: []
            });
        } else {
            state = updateState(chatId, {
                ...initialState,
                messageId: messageData.messageId,
                isStreaming: true,
                lastActive: new Date(),
                toolResults: state.toolResults || [],
                transactions: state.transactions || []
            });
        }

        const processToolCall = async (toolCallData: ToolCall): Promise<void> => {
            try {
                const args = typeof toolCallData.arguments === 'string' ? 
                    JSON.parse(toolCallData.arguments) : toolCallData.arguments;

                const toolResults = await handleToolCalls([{
                    name: toolCallData.name,
                    arguments: args
                }], {
                    userId: messageData.userId,
                    chatId,
                    chainId: state?.chainId,
                    userAddress: state?.userAddress
                });

                for (const toolResult of toolResults) {
                    const toolResultData = JSON.parse(toolResult.result);

                    if (toolResultData.error) {
                        // Save error to DB
                        if (messageData.messageId) {
                            await prisma.message.update({
                                where: { id: messageData.messageId },
                                data: {
                                    content: encrypt(toolResultData.error.message),
                                    toolData: encrypt(JSON.stringify({
                                        type: 'ERROR',
                                        error: toolResultData.error
                                    }))
                                }
                            });
                        }

                        // Update state with error
                        state = updateState(chatId, {
                            hasToolData: true,
                            toolResults: [...(state?.toolResults || []), {
                                toolCall: toolCallData,
                                result: JSON.stringify({
                                    success: false,
                                    error: toolResultData.error
                                })
                            }]
                        });

                        // Emit error response
                        await emitStreamResponse(chatId, {
                            ...messageData,
                            success: false,
                            message: toolResultData.error.message,
                            toolData: {
                                type: 'ERROR',
                                error: toolResultData.error
                            }
                        });

                        // Clear status and emit stream end for error case
                        await emitStatus(chatId, '');
                        await emitStreamEnd(chatId);
                        return;
                    }

                    // Continue with existing success case handling
                    // Handle different tool result types
                    if (toolResultData.transaction) {
                        // Transaction tool result
                        const txData = JSON.stringify({
                            transaction: toolResultData.transaction,
                            buttonText: toolResultData.buttonText,
                            message: toolResultData.message,
                            chainId: toolResultData.chainId
                        });
                        
                        // Check if transaction already exists for this message
                        if (messageData.messageId) {
                            const existingTransaction = await prisma.transaction.findUnique({
                                where: { messageId: messageData.messageId }
                            });

                            if (existingTransaction) {
                                // Use existing transaction instead of creating new one
                                const decryptedData = JSON.parse(decrypt(existingTransaction.data));
                                const response: Partial<IStreamResponse> = {
                                    ...messageData,
                                    success: true,
                                    chatId,
                                    message: toolResultData.message,
                                    transaction: {
                                        ...existingTransaction,
                                        data: decryptedData
                                    }
                                };

                                if (toolResultData.toolData) {
                                    response.toolData = toolResultData.toolData;
                                }

                                await emitStreamResponse(chatId, response);
                                return;
                            }
                        }
                        
                        // Create new transaction if none exists
                        // Send initial response with transaction data
                        const response: Partial<IStreamResponse> = {
                            ...messageData,
                            success: !toolResultData.error,
                            chatId,
                            message: toolResultData.message
                        };

                        // Add toolData if present
                        if (toolResultData.toolData) {
                            response.toolData = toolResultData.toolData;
                        }

                        // Add transaction data
                        response.transaction = {
                            id: '', // Will be replaced when transaction is created
                            hash: null,
                            status: 'PENDING',
                            type: toolCallData.name,
                            data: JSON.parse(txData),
                            chainId: toolResultData.chainId,
                            userId: messageData.userId!,
                            messageId: messageData.messageId!,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        };

                        await emitStreamResponse(chatId, response);

                        if (messageData.messageId) {
                            // Create transaction in DB
                            const transaction = await prisma.transaction.create({
                                data: {
                                    hash: null,
                                    status: 'PENDING',
                                    type: toolCallData.name,
                                    data: encrypt(txData),
                                    chainId: toolResultData.chainId,
                                    messageId: messageData.messageId,
                                    userId: messageData.userId!
                                }
                            });

                            // Update message with transaction
                            await prisma.message.update({
                                where: { id: messageData.messageId },
                                data: {
                                    transaction: {
                                        connect: { id: transaction.id }
                                    }
                                }
                            });

                            // Fetch full transaction with decrypted data
                            const fullTransaction = await prisma.transaction.findUnique({
                                where: { id: transaction.id }
                            });

                            if (fullTransaction) {
                                const decryptedData = JSON.parse(decrypt(fullTransaction.data));
                                // Send updated response with created transaction
                                const updatedResponse: Partial<IStreamResponse> = {
                                    ...messageData,
                                    success: !toolResultData.error,
                                    chatId,
                                    message: toolResultData.message,
                                    transaction: {
                                        ...fullTransaction,
                                        data: decryptedData
                        }
        };

                                if (toolResultData.toolData) {
                                    updatedResponse.toolData = toolResultData.toolData;
        }


                                await emitStreamResponse(chatId, updatedResponse);
                            }

                            // Update state with created transaction
                        state = updateState(chatId, {
                                toolResults: [...(state?.toolResults || []), {
                                    toolCall: toolCallData,
                                    result: toolResult.result
                                }],
                            hasToolData: true,
                                hasTxTool: true,
                                transactions: [...(state?.transactions || []), {
                                    ...transaction,
                                    data: txData // Store decrypted data in memory
                                }]
                        });
                    } else {
                            // Store transaction data for later if no messageId
                            state = updateState(chatId, {
                                toolResults: [...(state?.toolResults || []), {
                                    toolCall: toolCallData,
                                    result: toolResult.result
                                }],
                            hasToolData: true,
                                hasTxTool: true,
                                pendingTransactionData: txData
                            });
                        }

                        // Update result with message
                        if (toolResultData.message) {
                            result += '\n' + toolResultData.message;
                            state = updateState(chatId, {
                                pendingMessageContent: result,
                                lastActive: new Date()
                        });
                        }
                    } else if (toolResultData.toolData && toolResultData.toolData.type != "MEMORY_STORED") {
                        // Tool data result
                        const response: Partial<IStreamResponse> = {
                            ...messageData,
                            success: !toolResultData.error,
                            chatId,
                            message: toolResultData.message,
                            toolData: toolResultData.toolData
                        };

                        await emitStreamResponse(chatId, response);

                        // Save tool data to message
                        if (messageData.messageId) {
                            await prisma.message.update({
                                where: { id: messageData.messageId },
                                data: {
                                    toolData: encrypt(JSON.stringify(toolResultData.toolData))
                                }
                        });
                    }

                        if (toolResultData.message) {
                            result += '\n' + toolResultData.message;
                            state = updateState(chatId, {
                                pendingMessageContent: result,
                                lastActive: new Date(),
                                toolResults: [...(state?.toolResults || []), {
                                    toolCall: toolCallData,
                                    result: toolResult.result
                                }],
                                hasToolData: true,
                                hasTxTool: false
                            });
                }
                    } else if (toolResultData?.toolData?.memories && toolResultData?.toolData?.type == "MEMORY_STORED") {
                        // Memory tool result
                        state = updateState(chatId, {
                            toolResults: [...(state?.toolResults || []), {
                                toolCall: toolCallData,
                                result: toolResult.result
                            }],
                            hasToolData: true,
                            hasMemories: true,
                            hasTxTool: false,
                            transactions: state?.transactions || []
                        });

                        // Update memory chatId if not set
                        if (messageData.messageId && toolResultData?.toolData?.memories) {
                            for (const memory of toolResultData.toolData.memories) {
                                if (!memory.chatId) {
                                    await prisma.memory.update({
                                        where: { id: memory.id },
                                        data: { chatId }
                                    });
                                }
                            }
                        }
            
                        // Save memories to message
                        if (messageData.messageId) {
                            await prisma.message.update({
                                where: { id: messageData.messageId },
                                data: {
                                    memories: {
                                        connect: toolResultData.toolData.memories.map((memory: any) => ({ id: memory.id }))
                                    }
                                }
                            });
                        }

                        // Combine previous LLM response with memory context for new processing
                        if (toolResultData.llmContext) {
                            const combinedContext = `Previous response: ${result}\n\n${toolResultData.llmContext.content}`;
                            
                            const userSettings = await prisma.userSettings.findUnique({
                                where: { userId: messageData.userId! }
                            });

                            // Get new response from LLM with combined context
                            const llmService = await createLLMService(userSettings?.llmModel || ASSISTANT_CONFIG.MODELS.CHAT);
                            const llmResponse = await llmService.generateResponse([{
                                role: 'lunark',
                                content: combinedContext
                            }], { model: userSettings?.llmModel || ASSISTANT_CONFIG.MODELS.CHAT }).next();

                            if (llmResponse.value && llmResponse.value.content) {
                                // Update result with new LLM response
                                result = llmResponse.value.content;

                        state = updateState(chatId, {
                            pendingMessageContent: result,
                            lastActive: new Date()
                        });
                    }
                }

                        // Send tool response with memories and updated content
                        const response: Partial<IStreamResponse> = {
                            ...messageData,
                            success: !toolResultData.error,
                            chatId,
                            message: result || toolResultData.llmContext?.content,
                            memories: toolResultData.toolData.memories,
                            toolData: toolResultData.toolData
                        };

                        await emitStreamResponse(chatId, response);
                    } else {
                        // Handle error or simple message response
                        const response: Partial<IStreamResponse> = {
                            ...messageData,
                            success: !toolResultData.error,
                            chatId,
                            message: toolResultData.message
                        };

                        await emitStreamResponse(chatId, response);

                        if (toolResultData.message) {
                            result += '\n' + toolResultData.message;
                            state = updateState(chatId, {
                                pendingMessageContent: result,
                                lastActive: new Date(),
                                toolResults: [...(state?.toolResults || []), {
                                    toolCall: toolCallData,
                                    result: toolResult.result
                                }]
                            });

                            // Update message content in database
                            if (messageData.messageId) {
                                await prisma.message.update({
                                    where: { id: messageData.messageId },
                                    data: {
                                        content: encrypt(result)
                    }
                });

                                // Wait for status to be cleared
                                await emitStatus(chatId, '');
                            }
                        }
                    }
                }
            } catch (error) {
                let userFriendlyMessage = 'An unexpected error occurred while processing your request.';
                let errorType = 'EXECUTION_ERROR';
                
                if (error instanceof Error) {
                    // Handle Prisma specific errors
                    if ('code' in error && error.code === 'P2002') {
                        userFriendlyMessage = 'A transaction for this message already exists.';
                        errorType = 'DUPLICATE_TRANSACTION';
                    } else {
                        // Parse technical error into user-friendly message
                        userFriendlyMessage = 'Unable to process the transaction at this time. Please try again.';
                    }
                }

                // Update state with error but keep technical details in logs only
                state = updateState(chatId, {
                    hasToolData: true,
                    toolResults: [...(state?.toolResults || []), {
                        toolCall: toolCallData,
                        result: JSON.stringify({
                            success: false,
                            error: {
                                type: errorType,
                                message: userFriendlyMessage
                            }
                        })
                    }]
                });

                // Save user-friendly error to DB
                if (messageData.messageId) {
                    await prisma.message.update({
                        where: { id: messageData.messageId },
                        data: {
                            content: encrypt(userFriendlyMessage),
                            toolData: encrypt(JSON.stringify({
                                type: 'ERROR',
                                error: {
                                    type: errorType,
                                    message: userFriendlyMessage
                                }
                            }))
                        }
                    });
                }

                // Emit user-friendly error response
                await emitStreamResponse(chatId, {
                    ...messageData,
                    success: false,
                    message: userFriendlyMessage,
                    toolData: {
                        type: 'ERROR',
                        error: {
                            type: errorType,
                            message: userFriendlyMessage
                        }
                    }
                });

                // Clear status and emit stream end for error case
                await emitStatus(chatId, '');
                await emitStreamEnd(chatId);
            }
        };
            
        for await (const chunk of responseStream as AsyncGenerator<IStreamChunk>) {
            if (isAborted) {
                // Save the current state and message with the pending content
                if (messageData.messageId && state.pendingMessageContent) {
                    await prisma.message.update({
                        where: { id: messageData.messageId },
                        data: {
                            content: encrypt(state.pendingMessageContent)
                        }
                    });
                }

                // Emit final response with current content
                await emitStreamResponse(chatId, {
                    ...messageData,
                    success: true,
                    chatId,
                    message: state.pendingMessageContent,
                    role: 'lunark'
                });

                await emitStreamEnd(chatId);
                return state.pendingMessageContent;
            }

            try {
                // Let's check the OpenAI response format
                const toolCalls = Array.isArray(chunk.toolCalls) ? chunk.toolCalls :
                    chunk.choices?.[0]?.delta?.toolCalls || [];

                // Process tool calls if they exist
                if (toolCalls.length > 0) {
                    for (const rawToolCall of toolCalls) {
                        try {
                            // Normalize the tool call format
                            const normalizedToolCall = {
                                id: rawToolCall.id || '',
                                function: {
                                    name: rawToolCall.function?.name || '',
                                    arguments: rawToolCall.function?.arguments || ''
                                }
                            };

                            if (normalizedToolCall.function.name && normalizedToolCall.function.arguments) {
                                await processToolCall({
                                    name: normalizedToolCall.function.name,
                                    arguments: typeof normalizedToolCall.function.arguments === 'string' 
                                        ? JSON.parse(normalizedToolCall.function.arguments)
                                        : normalizedToolCall.function.arguments
                                });
                            }
                        } catch (toolError) {}
                    }
                }

                // Content processing
                const content = chunk.content || chunk.choices?.[0]?.delta?.content;
                if (content) {
                    result += content;
                    state = updateState(chatId, {
                        pendingMessageContent: result,
                        lastChunk: chunk,
                        lastActive: new Date()
                    });

                    await emitStreamResponse(chatId, {
                        ...messageData,
                        success: true,
                        chatId,
                        message: result,
                        role: 'lunark'
                    });
                }
            } catch (error) {}
        }

        // Update final tool call handling
        const finalToolCall = currentToolCall as ICurrentToolCall | null;
        if (finalToolCall && !finalToolCall.isComplete) {
            await processToolCall({
                name: finalToolCall.function.name,
                arguments: finalToolCall.function.arguments
            });
        }

        // Create transaction if we have pending transaction data and messageId
        if (state?.pendingTransactionData && messageData.messageId) {
            try {
                const txData = state.pendingTransactionData;
                const parsedTxData = JSON.parse(txData);

                // Create transaction in DB
                const transaction = await prisma.transaction.create({
                    data: {
                        hash: null,
                        status: 'PENDING',
                        type: 'transfer',
                        data: encrypt(txData),
                        chainId: parsedTxData.chainId,
                        messageId: messageData.messageId,
                        userId: messageData.userId!
                    }
                });

                // Update state with created transaction
                state = updateState(chatId, {
                    transactions: [...(state?.transactions || []), {
                        ...transaction,
                        data: txData // Store decrypted data in memory
                    }],
                    pendingTransactionData: undefined // Clear pending data
                });

                // Emit updated response with transaction
                const fullTransaction = await prisma.transaction.findUnique({
                    where: { id: transaction.id }
                });

                if (fullTransaction) {
                    const decryptedData = JSON.parse(decrypt(fullTransaction.data));
                    emitStreamResponse(chatId, {
                        ...messageData,
                        success: true,
                        chatId,
                        transaction: {
                            ...fullTransaction,
                            data: decryptedData
                        }
                    });
                }
            } catch (error) {}
        }

        // Clear status and emit stream end
        await emitStatus(chatId, '');
        await emitStreamEnd(chatId);

        state = updateState(chatId, {
            isStreaming: false,
            lastActive: new Date()
        });

        // Update final message content
        if (messageData.messageId && result) {
            // Create short-term memory for the conversation
            await memoryService.store({
                type: 'SHORT_TERM',
                content: result,
                userId: messageData.userId!,
                chatId: messageData.chatId!,
                importance: 0.5,
                timestamp: new Date()
            });
            
            await prisma.message.update({
                where: { id: messageData.messageId },
                data: {
                    content: encrypt(result)
                }
            });
        }

        return result;
    } catch (error) {
        if (state) {
            state = updateState(chatId, {
                isStreaming: false,
                lastActive: new Date(),
                pendingMessageContent: error instanceof Error ? error.message : 'An error occurred'
            });
            
            emitStatus(chatId, '');
        }

        emitError(chatId, error);

        throw error;
    }
}; 