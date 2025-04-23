import { findToken } from '@/core/tokens/tokenRegistry';
import { log } from '@/common/utils/log';
import { Tool } from '../tools';
import { chains } from '@/core/networks/chains';

interface Deployment {
    chainId: number;
    address: string;
}

interface ResolveTokenArgs {
    symbol: string;
    chainId: number;
}

export const resolveToken: Tool<ResolveTokenArgs> = {
    name: 'resolve_token',
    definition: {
        type: 'function',
        function: {
            name: 'resolve_token',
            description: 'Resolve a token symbol to its address on a specific chain',
            parameters: {
                type: 'object',
                properties: {
                    symbol: {
                        type: 'string',
                        description: 'The token symbol to resolve'
                    },
                    chainId: {
                        type: 'number',
                        description: 'Chain ID to get specific deployment'
                    }
                },
                required: ['symbol', 'chainId']
            }
        }
    },
    instructions: `"resolve_token": Resolve a token symbol to get its deployment information across different chains.`,
    handler: async (args) => {
        try {
            const { symbol, chainId } = args;

            const nativeChains = Object.entries(chains)
                .filter(([_, chain]) => chain.nativeCurrency.symbol.toUpperCase() === symbol.toUpperCase())
                .map(([id, chain]) => ({
                    chainId: parseInt(id),
                    name: chain.name
                }));

            if (nativeChains.length > 0) {
                const nativeChain = nativeChains.find(chain => chain.chainId === chainId);
                if (nativeChain) {
                    return {
                        success: true,
                        message: `${symbol} is the native token of ${nativeChain.name} (Chain ID: ${chainId}). Would you like to transfer this token or check its balance?`,
                        data: {
                            symbol: symbol,
                            chainId: chainId,
                            isNative: true
                        }
                    };
                }
            }

            const token = await findToken(symbol, chainId);
            if (!token) {
                return {
                    success: false,
                    error: {
                        type: 'VALIDATION_ERROR',
                        message: `I couldn't find ${symbol} token on ${chains[chainId]?.name || chainId}. Let me help you verify the token symbol or suggest available tokens on this network.`,
                        details: { symbol, chainId }
                    },
                    requiresLLMProcessing: true
                };
            }

            const deployment = token.deployments.find((d: Deployment) => d.chainId === chainId);

            if (!deployment) {
                return {
                    success: false,
                    error: {
                        type: 'WRONG_CHAIN',
                        message: `${symbol} token is not available on ${chains[chainId]?.name || chainId}. Would you like to try a different network where this token is available?`,
                        details: { 
                            symbol, 
                            chainId,
                            availableChains: token.deployments.map((d: Deployment) => d.chainId)
                        }
                    },
                    requiresLLMProcessing: true
                };
            }

            return {
                success: true,
                message: `I found ${token.symbol} on ${chains[chainId]?.name || `Chain ${chainId}`}. Would you like to transfer this token or check its balance?`,
                data: {
                    symbol: token.symbol,
                    chainId: deployment.chainId,
                    address: deployment.address
                }
            };

        } catch (error) {
            return {
                success: false,
                error: {
                    type: 'EXECUTION_ERROR',
                    message: 'I encountered an issue while looking up the token. Let me help you verify the details.',
                    details: error
                },
                requiresLLMProcessing: true
            };
        }
    }
};