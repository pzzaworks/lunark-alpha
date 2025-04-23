import { encoding_for_model } from 'tiktoken';
import { log } from '@/common/utils/log';
import prisma from '@/infrastructure/database/prisma';
import { ASSISTANT_CONFIG } from '@/config/assistant.config';

export function getTokenCount(text: string, model: string = ASSISTANT_CONFIG.MODELS.CHAT): number {
    try {
        const modelOverride = "gpt-4o-mini";
        const encoder = encoding_for_model(modelOverride as any);
        const tokens = encoder.encode(text).length;
        encoder.free();
        
        return tokens;
    } catch (error) {
        throw error;
    }
}

export function calculateCost(
    promptTokens: number, 
    completionTokens: number, 
    model: string = ASSISTANT_CONFIG.MODELS.CHAT,
    estimate: boolean = false
): number {
    try {
        const rates: Record<string, { prompt: number, completion: number }> = {
            'openai/gpt-4o-mini': { prompt: 0.15, completion: 0.6 }
        };

        let currentModel = model;
        const defaultModel = ASSISTANT_CONFIG.MODELS.CHAT;

        if (!rates[currentModel]) {
            currentModel = defaultModel;
        }

        let cost = ((promptTokens * rates[currentModel].prompt) + 
                     (completionTokens * rates[currentModel].completion)) / 1_000_000;
        
        const platformFee = 0.005;

        if (estimate) {
            const avgCostForTools = 0.001;
            return Math.ceil(cost + avgCostForTools + platformFee);
        }
        
        return cost + platformFee;
    } catch (error) {
        throw error;
    }
}

export async function checkEnoughBalance(
    userId: string, 
    promptTokens: number, 
    model: string = ASSISTANT_CONFIG.MODELS.CHAT,
    estimate: boolean = false
): Promise<boolean> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { balance: true }
        });

        if (!user) {
            return false;
        }

        const estimatedCost = calculateCost(promptTokens, promptTokens * 6, model, estimate);
        const hasEnoughBalance = user.balance >= estimatedCost;

        return hasEnoughBalance;
    } catch (error) {
        throw error;
    }
}

export async function updateUsage(
    userId: string, 
    chatId: string,
    messageId: string,
    promptTokens: number, 
    completionTokens: number, 
    cost: number,
    costBreakdown: string
): Promise<void> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { balance: true }
        });

        if (!user) {
            throw new Error('User not found');
        }

        const actualDecrementAmount = Math.min(cost, user.balance);

        const message = await prisma.message.findUnique({
            where: { id: messageId },
            select: { costBreakdown: true, chatId: true }
        });

        if (!message) {
            throw new Error('Message not found');
        }

        let existingBreakdown = [];
        if (message?.costBreakdown) {
            try {
                existingBreakdown = JSON.parse(message.costBreakdown);
            } catch (error) {}
        }

        if (!Array.isArray(existingBreakdown)) {
            existingBreakdown = existingBreakdown ? [existingBreakdown] : [];
        }

        const newBreakdown = typeof costBreakdown === 'string' 
            ? JSON.parse(costBreakdown) 
            : costBreakdown;

        existingBreakdown.push(newBreakdown);

        // Find or update existing usage for the chat
        const existingUsage = await prisma.usage.findFirst({
            where: {
                AND: [
                    { userId },
                    { chatId }
                ]
            }
        });

        await prisma.$transaction([
            // Handle usage record
            existingUsage 
                ? prisma.usage.update({
                    where: { id: existingUsage.id },
                    data: {
                        messageId,  // Update with latest message
                        promptTokens: { increment: promptTokens },
                        completionTokens: { increment: completionTokens },
                        totalTokens: { increment: promptTokens + completionTokens },
                        totalCost: { increment: actualDecrementAmount }
                    }
                })
                : prisma.usage.create({
                    data: {
                        messageId,
                        userId,
                        chatId,
                        promptTokens,
                        completionTokens,
                        totalTokens: promptTokens + completionTokens,
                        totalCost: actualDecrementAmount,
                        toolCost: 0
                    }
                }),
            // Update user balance
            prisma.user.update({
                where: { id: userId },
                data: {
                    balance: {
                        decrement: actualDecrementAmount
                    }
                }
            }),
            // Update message cost
            prisma.message.update({
                where: { id: messageId },
                data: {
                    cost: { increment: cost },
                    costBreakdown: JSON.stringify(existingBreakdown)
                }
            })
        ]);
    } catch (error) {
        throw error;
    }
}