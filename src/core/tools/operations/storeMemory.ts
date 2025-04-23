import { store } from '@/core/memory/memory';
import { Tool } from '../tools';
import { log } from '@/common/utils/log';
import prisma from '@/infrastructure/database/prisma';

interface StoreMemoryArgs {
    content: string;
    metadata?: string;
    type?: string;
    userId: string;
    importance?: number;
    chatId?: string;
}

export const storeMemory: Tool<StoreMemoryArgs> = {
    name: 'store_memory',
    definition: {
        type: 'function',
        function: {
            name: 'store_memory',
            description: 'Store important user information or explicitly requested memories in the memory system. Use only for significant information that should be remembered long-term.',
            parameters: {
                type: 'object',
                properties: {
                    content: {
                        type: 'string',
                        description: 'The content to store in memory'
                    },
                    type: {
                        type: 'string',
                        description: 'The type of memory (LONG_TERM for important user info, preferences, or explicit requests)'
                    },
                    userId: {
                        type: 'string',
                        description: 'The user ID associated with this memory (required)'
                    },
                    chatId: {
                        type: 'string',
                        description: 'The chat ID associated with this memory'
                    },
                    importance: {
                        type: 'number',
                        description: 'Importance score between 0 and 1 (use 0.8+ for crucial user preferences)'
                    },
                    metadata: {
                        type: 'string',
                        description: 'Optional metadata about why this memory was stored'
                    }
                },
                required: ['content', 'userId']
            }
        }
    },
    instructions: `"store_memory": Store crucial user information or explicitly requested memories. Use for:
    1. User preferences and settings
    2. Important personal information shared by user
    3. Information user explicitly asks to remember`,
    handler: async (args: StoreMemoryArgs) => {
        try {
            const user = await prisma.user.findUnique({
                where: { id: args.userId }
            });

            if (!user) {
                return {
                    success: false,
                    error: {
                        type: 'USER_NOT_FOUND',
                        message: 'Cannot store memory: User not found in the system.',
                        requiresLLMProcessing: true
                    }
                };
            }
            
            const storedMemory = await store({
                content: args.content,
                type: args.type || 'LONG_TERM',
                userId: args.userId,
                chatId: args.chatId,
                importance: args.importance || 0.8,
                timestamp: new Date(),
                metadata: args.metadata
            });

            return {
                success: true,
                toolData: {
                    type: 'MEMORY_STORED',
                    memory: storedMemory,
                    memories: [storedMemory]
                },
                llmContext: {
                    role: 'system',
                    content: `I've stored this information in my memory: "${args.content}". Now respond to the user naturally, acknowledging that you'll remember this information, and continue the conversation based on the context.`
                }
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    type: 'MEMORY_STORE_ERROR',
                    message: 'Failed to store memory. Please try again later.',
                    details: error instanceof Error ? error.message : 'Unknown error',
                    requiresLLMProcessing: true
                }
            };
        }
    }
};