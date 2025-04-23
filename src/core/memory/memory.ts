import { getIO } from '../../infrastructure/socket/server';
import { log } from '@/common/utils/log';
import prisma from '@/infrastructure/database/prisma';
import { encrypt, decrypt } from '@/common/utils/encrypt';
import { llmFactory } from '../llm/factory';
import { LLMRole } from '../llm/factory';
import { updateStatus } from '@/infrastructure/socket/handlers';

export interface IMemory {
    id?: string;
    content: string;
    type: string;
    userId: string;
    chatId?: string | null;
    importance: number;
    timestamp: Date;
    metadata?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
}

interface RecallParams {
    userId: string;
    chatId: string;
    type: 'SHORT_TERM' | 'LONG_TERM' | 'RESEARCH_RESULT' | 'ANALYSIS_INPUT' | 'DECISION_INPUT' | 'VALIDATION_INPUT';
    minImportance?: number;
}

export type MemoryType = RecallParams['type'];

async function manageShortTermMemories(chatId: string, newContent: string) {
    try {
        const existingMemory = await prisma.memory.findFirst({
            where: {
                chatId,
                type: 'SHORT_TERM'
            }
        });

        const lastSummaryTime = existingMemory ? existingMemory.timestamp : new Date(0);
        const newMessages = await prisma.message.findMany({
            where: { 
                chatId,
                createdAt: { gt: lastSummaryTime }
            },
            orderBy: { createdAt: 'asc' },
            select: {
                content: true,
                role: true,
                userId: true,
                createdAt: true
            }
        });

        if (newMessages.length < 2) {
            return;
        }

        const userId = newMessages[0].userId;
        
        let summaryContext = '';
        if (existingMemory) {
            const existingSummary = decrypt(existingMemory.content);
            const truncatedSummary = existingSummary.length > 300 ? 
                existingSummary.substring(0, 300) + '...' : 
                existingSummary;
            summaryContext = `Previous summary: ${truncatedSummary}\n\nNew messages:\n`;
        }

        const formattedMessages = newMessages.map(msg => {
            const content = decrypt(msg.content);
            return `${msg.role === 'user' ? 'User' : 'Assistant'}: ${content}`;
        }).join('\n');

        const userSettings = await prisma.userSettings.findUnique({
            where: { userId }
        }) || await prisma.userSettings.create({
            data: { userId }
        });

        const llmService = await llmFactory.createLLMService(userSettings.llmModel);
        const llmMessages = [
            {
                role: 'lunark' as LLMRole,
                content: `You are a highly efficient conversation summarizer. Create an extremely concise summary (maximum 300 characters) that captures only the most essential points.

Key requirements:
1. Keep the summary UNDER 300 characters
2. Focus ONLY on critical information:
   - Main user intent/request
   - Key decisions or actions taken
   - Important technical details (amounts, addresses)
3. Use very concise language
4. Skip pleasantries and general chat
5. If there's previous summary, only add new critical information

Remember: Your summary MUST be under 300 characters. Be ruthlessly concise.`
            },
            {
                role: 'user' as LLMRole,
                content: `${summaryContext}${formattedMessages}`
            }
        ];

        let summary = '';
        const responseStream = llmService.generateResponse(llmMessages, {
            model: userSettings.llmModel,
            temperature: 0.3,
            maxTokens: 100
        });

        for await (const response of responseStream) {
            if (response.content) {
                summary += response.content;
            }
        }

        if (summary.length > 300) {
            summary = summary.substring(0, 297) + '...';
        }

        if (existingMemory) {
            await prisma.memory.update({
                where: { id: existingMemory.id },
                data: {
                    content: encrypt(summary),
                    timestamp: new Date()
                }
            });
        } else {
            await prisma.memory.create({
                data: {
                    type: 'SHORT_TERM',
                    content: encrypt(summary),
                    importance: 0.5,
                    userId,
                    chatId,
                    timestamp: new Date()
                }
            });
        }
    } catch (error) {
        throw error;
    }
}

export async function store(memory: IMemory) {
    try {
        if (!memory.content || !memory.type || !memory.userId) {
            throw new Error('Memory content, type and userId are required');
        }

        if (memory.type === 'SHORT_TERM' && memory.chatId) {
            await manageShortTermMemories(memory.chatId, memory.content);
            
            const currentSummary = await prisma.memory.findFirst({
                where: {
                    chatId: memory.chatId,
                    type: 'SHORT_TERM'
                }
            });

            if (currentSummary) {
                return {
                    ...currentSummary,
                    content: decrypt(currentSummary.content),
                    metadata: currentSummary.metadata ? decrypt(currentSummary.metadata) : null,
                };
            }
            
            return {
                ...memory,
                content: memory.content,
                metadata: memory.metadata
            };
        }

        const dbMemory = await prisma.memory.create({
            data: {
                content: encrypt(memory.content),
                type: memory.type,
                userId: memory.userId,
                chatId: memory.chatId,
                importance: memory.importance,
                timestamp: memory.timestamp || new Date(),
                metadata: memory.metadata ? encrypt(memory.metadata) : null
            }
        });

        return {
            ...dbMemory,
            content: decrypt(dbMemory.content),
            metadata: dbMemory.metadata ? decrypt(dbMemory.metadata) : null,
        };
    } catch (error) {
        throw error;
    }
}

export async function recall({ userId, chatId, type, minImportance = 0 }: RecallParams) {
    try {
        updateStatus(chatId, 'Lunark is recalling memories...');
            
        if (type === 'SHORT_TERM') {
            const latestSummary = await prisma.memory.findFirst({
                where: {
                    chatId,
                    type: 'SHORT_TERM'
                },
                orderBy: {
                    timestamp: 'desc'
                }
            });

            if (!latestSummary) {
                return [];
            }

            return [{
                ...latestSummary,
                content: decrypt(latestSummary.content),
                metadata: latestSummary.metadata ? decrypt(latestSummary.metadata) : null
            }];
        }

        const memories = await prisma.memory.findMany({
            where: {
                userId,
                ...(type === 'LONG_TERM' ? 
                    { type } : 
                    { chatId, type }
                ),
                importance: minImportance ? { gte: minImportance } : undefined
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: type === 'LONG_TERM' ? 20 : 10
        });

        updateStatus(chatId, 'Lunark is processing memories...');
        
        const decryptedMemories = memories.map(memory => ({
            ...memory,
            content: decrypt(memory.content),
            metadata: memory.metadata ? decrypt(memory.metadata) : null
        }));

        return decryptedMemories;
    } catch (error) {
        throw error;
    }
}

export async function deleteMemories({ chatId, userId }: { chatId?: string; userId?: string }) {
    try {
        const result = await prisma.memory.deleteMany({
            where: {
                ...(chatId && { chatId }),
                ...(userId && { userId })
            }
        });

        return result;
    } catch (error) {
        throw error;
    }
} 