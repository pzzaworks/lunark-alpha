import { Token, TokenDeployment, TokenToolSupport, Prisma } from '@/infrastructure/database/prisma-client';
import { log } from '@/common/utils/log';
import prisma from '@/infrastructure/database/prisma';
import { chains } from '@/core/networks/chains';

export interface TokenInfo extends Token {
    deployments: (TokenDeployment & {
        toolSupport: TokenToolSupport[];
    })[];
    toolSupport: TokenToolSupport[];
}

type TokenWithRelations = Prisma.TokenGetPayload<{
    include: {
        deployments: {
            include: {
                toolSupport: true;
            };
        };
        toolSupport: true;
    };
}>;

export async function findToken(symbol: string, chainId?: number): Promise<TokenInfo | null> {
    try {
        const normalizedSymbol = symbol.toUpperCase();

        const token = await prisma.token.findFirst({
            where: {
                OR: [
                    { symbol: { equals: normalizedSymbol, mode: 'insensitive' } },
                    { symbol: { contains: normalizedSymbol, mode: 'insensitive' } },
                    { commonNames: { hasSome: [normalizedSymbol] } }
                ]
            },
            include: {
                deployments: {
                    where: chainId ? { chainId } : undefined,
                    include: {
                        toolSupport: true
                    }
                },
                toolSupport: true
            }
        });

        if (!token) {
            return null;
        }

        if (chainId && token.deployments.length === 0) {
            return null;
        }

        return token as TokenInfo;

    } catch (error) {
        return null;
    }
}

export async function getTokensByChain(chainId: number): Promise<TokenInfo[]> {
    const tokens = await prisma.token.findMany({
        where: {
            deployments: {
                some: {
                    chainId: chainId
                }
            }
        },
        include: {
            deployments: {
                include: {
                    toolSupport: true
                }
            },
            toolSupport: true
        }
    });

    return tokens as TokenInfo[];
}

export async function getTokensByTool(toolId: string): Promise<TokenInfo[]> {
    const tokens = await prisma.token.findMany({
        where: {
            OR: [
                {
                    toolSupport: {
                        some: {
                            toolName: toolId,
                            isEnabled: true
                        }
                    }
                },
                {
                    deployments: {
                        some: {
                            toolSupport: {
                                some: {
                                    toolName: toolId,
                                    isEnabled: true
                                }
                            }
                        }
                    }
                }
            ]
        },
        include: {
            deployments: {
                include: {
                    toolSupport: true
                }
            },
            toolSupport: true
        }
    });

    return tokens as TokenInfo[];
}

export function formatTokenAmount(amount: string, token: TokenInfo, chainId: number): string {
    const deployment = token.deployments.find(d => d.chainId === chainId);
    if (!deployment) {
        throw new Error(`Token ${token.symbol} is not deployed on chain ${chainId}`);
    }
    return `${amount} ${token.symbol} (${chains[chainId].name})`;
}

export async function getHumanReadableTokenList(): Promise<string> {
    const tokens = await prisma.token.findMany({
        include: {
            deployments: true
        }
    }) as TokenWithRelations[];

    const byChain = tokens.reduce((acc: Record<string, Set<string>>, token: TokenWithRelations) => {
        token.deployments.forEach((deployment: TokenDeployment) => {
            const chainName = chains[deployment.chainId].name;
            if (!acc[chainName]) acc[chainName] = new Set<string>();
            acc[chainName].add(token.symbol);
        });
        return acc;
    }, {});

    return Object.entries(byChain)
        .map(([chain, tokenSet]) => `${chain}: ${Array.from(tokenSet).join(', ')}`)
        .join('\n');
}

export async function isTokenSupportedByTool(
    tokenId: string,
    chainId: number,
    toolId: string
): Promise<{
    isSupported: boolean;
    restrictions?: {
        minAmount?: string;
        maxAmount?: string;
        params?: any;
    };
}> {
    const globalSupport = await prisma.tokenToolSupport.findFirst({
        where: {
            tokenId: tokenId,
            toolName: toolId,
            isEnabled: true,
            deploymentId: null
        }
    });

    if (globalSupport) {
        return {
            isSupported: true,
            restrictions: {
                minAmount: globalSupport.minAmount || undefined,
                maxAmount: globalSupport.maxAmount || undefined,
                params: globalSupport.params || undefined
            }
        };
    }

    const deploymentSupport = await prisma.tokenToolSupport.findFirst({
        where: {
            deployment: {
                tokenId: tokenId,
                chainId: chainId
            },
            toolName: toolId,
            isEnabled: true
        }
    });

    if (deploymentSupport) {
        return {
            isSupported: true,
            restrictions: {
                minAmount: deploymentSupport.minAmount || undefined,
                maxAmount: deploymentSupport.maxAmount || undefined,
                params: deploymentSupport.params || undefined
            }
        };
    }

    return { isSupported: false };
} 