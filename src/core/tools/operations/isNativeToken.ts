import { Tool } from '../tools';
import { chains } from '@/core/networks/chains';
import { log } from '@/common/utils/log';

interface IsNativeTokenArgs {
    symbol: string;
    chainId: number;
}

export const isNativeToken: Tool<IsNativeTokenArgs> = {
    name: 'is_native_token',
    definition: {
        type: 'function',
        function: {
            name: 'is_native_token',
            description: 'Check if a token symbol represents a native token (ETH, BNB, MATIC, etc.)',
            parameters: {
                type: 'object',
                properties: {
                    symbol: {
                        type: 'string',
                        description: 'The token symbol to check',
                    },
                    chainId: {
                        type: 'number',
                        description: 'Optional chain ID to check against specific network',
                    }
                },
                required: ['symbol']
            }
        }
    },
    instructions: `"is_native_token": Determines if a token symbol represents a native token (like ETH, BNB, MATIC) or an ERC20 token.`,
    handler: async ({ symbol, chainId }: IsNativeTokenArgs) => {
        try {
            const upperSymbol = symbol.toUpperCase();

            if (chainId) {
                const chain = chains[chainId];
                if (!chain) {
                    return {
                        success: false,
                        error: {
                            type: 'INVALID_CHAIN',
                            message: `Chain ID ${chainId} is not supported`,
                            requiresLLMProcessing: true
                        }
                    };
                }

                const isNative = chain.nativeCurrency.symbol.toUpperCase() === upperSymbol;
                return {
                    isNative,
                    chainId,
                    message: isNative 
                        ? `${symbol} is the native token of ${chain.name}`
                        : `${symbol} is not the native token of ${chain.name}`
                };
            }

            const nativeChains = Object.entries(chains)
                .filter(([_, chain]) => chain.nativeCurrency.symbol.toUpperCase() === upperSymbol)
                .map(([id, chain]) => ({
                    chainId: parseInt(id),
                    name: chain.name
                }));

            const isNative = nativeChains.length > 0;
            return {
                isNative,
                nativeChains: isNative ? nativeChains : undefined,
                message: isNative
                    ? `${symbol} is a native token on: ${nativeChains.map(c => c.name).join(', ')}`
                    : `${symbol} is not a native token on any supported chain`
            };

        } catch (error: any) {
            return {
                success: false,
                error: {
                    type: 'CHECK_FAILED',
                    message: error.message || 'Failed to check if token is native',
                    details: error,
                    requiresLLMProcessing: true
                }
            };
        }
    }
}; 