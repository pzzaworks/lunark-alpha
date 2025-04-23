import { Tool } from '../tools';
import { getAddress } from 'ethers';
import prisma from '@/infrastructure/database/prisma';

interface ResolveContactArgs {
    name: string;
    context?: {
        userId?: string;
        userAddress?: string;
    };
}

export const resolveContact: Tool<ResolveContactArgs> = {
    name: 'resolve_contact',
    definition: {
        type: 'function',
        function: {
            name: 'resolve_contact',
            description: 'Resolve a contact name to their Ethereum address',
            parameters: {
                type: 'object',
                properties: {
                    name: {
                        type: 'string',
                        description: 'The contact name to resolve'
                    },
                    context: {
                        type: 'object',
                        description: 'Context information from the system',
                        properties: {
                            userId: {
                                type: 'string',
                                description: 'Current user ID'
                            },
                            userAddress: {
                                type: 'string',
                                description: 'Current user wallet address'
                            }
                        }
                    }
                },
                required: ['name']
            }
        }
    },
    instructions: `Resolves a contact name to their Ethereum address.`,
    handler: async ({ name, context }: ResolveContactArgs) => {
        try {
            // If it's already an address, validate and return it
            if (name.startsWith('0x')) {
                try {
                    const validatedAddress = getAddress(name);
                    return {
                        success: true,
                        data: {
                            address: validatedAddress,
                            name: name
                        }
                    };
                } catch {
                    return {
                        success: false,
                        error: {
                            type: 'VALIDATION_ERROR',
                            message: `"${name}" is not a valid Ethereum address.`,
                            details: { name }
                        },
                        requiresLLMProcessing: true
                    };
                }
            }

            // If we have userId, try to find in user's contacts first
            if (context?.userId) {
                const contact = await prisma.contact.findFirst({
                    where: {
                        userId: context.userId,
                        name: {
                            equals: name,
                            mode: 'insensitive' // Case insensitive search
                        },
                        deletedAt: null
                    }
                });

                if (contact) {
                    try {
                        const validatedAddress = getAddress(contact.address);
                        return {
                            success: true,
                            data: {
                                address: validatedAddress,
                                name: contact.name
                            }
                        };
                    } catch (error) {
                        return {
                            success: false,
                            error: {
                                type: 'VALIDATION_ERROR',
                                message: `The stored address for contact "${name}" appears to be invalid.`,
                                details: { error }
                            },
                            requiresLLMProcessing: true
                        };
                    }
                }
            }

            // If no contact found, return contact not found error
            return {
                success: false,
                error: {
                    type: 'CONTACT_NOT_FOUND',
                    message: context?.userId 
                        ? `I couldn't find "${name}" in your address book. Please add them as a contact first or use their full Ethereum address.`
                        : `I couldn't find a contact named "${name}". Please use their full Ethereum address.`,
                    details: { name }
                },
                requiresLLMProcessing: true
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    type: 'EXECUTION_ERROR',
                    message: 'Failed to resolve username or contact',
                    details: { error }
                },
                requiresLLMProcessing: true
            };
        }
    }
}; 