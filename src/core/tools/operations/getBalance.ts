import { Tool } from '.';
import { getProvider } from '../provider';
import { formatEther, formatUnits, Contract, getAddress } from 'ethers';
import { log } from '@/common/utils/log';
import { chains } from '../../networks/chains';
import { ERC20_ABI } from '@/config/abi';
import { resolveToken } from './resolveToken';
import { resolveContact } from './resolveContact';

interface GetBalanceArgs {
    wallet?: string;  // Made optional since we might use userName instead
    userName?: string;  // Added userName as an alternative to wallet
    chainId: number;
    tokenAddress?: string;
    tokenSymbol?: string;
    context?: {
        userId?: string;
        userAddress?: string;
    };
}

export const getBalance: Tool<GetBalanceArgs> = {
    name: 'get_balance',
    definition: {
        type: 'function',
        function: {
            name: 'get_balance',
            description: 'Get the balance of a wallet (native or ERC20 tokens) on specified network',
            parameters: {
                type: 'object',
                properties: {
                    wallet: {
                        type: 'string',
                        pattern: '^0x[a-fA-F0-9]{40}$',
                        description: 'The wallet address to get the balance of'
                    },
                    userName: {
                        type: 'string',
                        description: 'The username or contact name to get the balance of'
                    },
                    chainId: {
                        type: 'number',
                        description: 'The chain ID of the network'
                    },
                    tokenAddress: {
                        type: 'string',
                        pattern: '^0x[a-fA-F0-9]{40}$',
                        description: 'The ERC20 token contract address. If not provided, native token balance will be returned.'
                    },
                    tokenSymbol: {
                        type: 'string',
                        description: 'The token symbol. If provided, will resolve to token address.'
                    },
                    context: {
                        type: 'object',
                        properties: {
                            userId: {
                                type: 'string',
                                description: 'The user ID'
                            },
                            userAddress: {
                                type: 'string',
                                description: 'The user address'
                            }
                        },
                        description: 'The context for resolving contact'
                    }
                },
                required: ['chainId']  // Changed required fields since we need either wallet or userName
            }
        }
    },
    instructions: '"get_balance": Gets the balance of a token (native or ERC20) for an address or username.',
    supportedChains: Object.values(chains).map(chain => chain.chainId),
    handler: async ({ wallet, userName, chainId, tokenAddress, tokenSymbol, context }: GetBalanceArgs) => {
        try {
            if (!getBalance.supportedChains?.includes(chainId)) {
                return {
                    success: false,
                    error: {
                        type: 'WRONG_CHAIN',
                        message: `The requested operation is not supported on ${chains[chainId].name} network (Chain ID: ${chainId}). Let me help you find a supported network.`,
                        supportedChains: getBalance.supportedChains,
                        currentChain: chainId
                    },
                    requiresLLMProcessing: true
                };
            }

            try {
                // Prioritize userName over wallet address if both are provided
                let resolvedWallet: string | undefined;
                if (userName) {
                    // If userName is provided, use it regardless of whether wallet address is provided
                    const contactResult = await resolveContact.handler({
                        name: userName,
                        context
                    });

                    if (!contactResult.success) {
                        if (contactResult.error.type === 'CONTACT_NOT_FOUND') {
                            return contactResult;
                        }
                        return {
                            success: false,
                            error: {
                                type: 'VALIDATION_ERROR',
                                message: `The address format doesn't look right. Let me help you verify it.`,
                                details: { error: contactResult.error }
                            },
                            requiresLLMProcessing: true
                        };
                    }

                    resolvedWallet = contactResult.data.address;
                } else if (!wallet) {
                    return {
                        success: false,
                        error: {
                            type: 'VALIDATION_ERROR',
                            message: 'Please provide either a wallet address or a username.',
                            details: { wallet, userName }
                        },
                        requiresLLMProcessing: true
                    };
                } else {
                    // Only use wallet address if no username is provided
                    resolvedWallet = wallet;
                }

                if (!resolvedWallet) {
                    return {
                        success: false,
                        error: {
                            type: 'VALIDATION_ERROR',
                            message: 'Failed to resolve wallet address.',
                            details: { wallet, userName }
                        },
                        requiresLLMProcessing: true
                    };
                }

                const validatedWallet = getAddress(resolvedWallet);
                const provider = await getProvider(chainId);
                const chain = chains[chainId];

                // Handle native token balance
                if (!tokenSymbol && !tokenAddress) {
                    const balance = await provider.getBalance(validatedWallet);
                    const nativeSymbol = chain.nativeCurrency.symbol;
                    const formattedBalance = formatEther(balance);

                    return {
                        success: true,
                        toolData: {
                            type: 'balance',
                            data: {
                                balance: `${formattedBalance} ${nativeSymbol}`,
                                wallet: validatedWallet,
                                chainId,
                                isNative: true
                            }
                        },
                        message: `Balance of ${validatedWallet} on ${chain.name} is ${formattedBalance} ${nativeSymbol}`
                    };
                }

                // Handle ERC20 token balance
                if (tokenSymbol) {
                    // Special handling for native token symbols
                    if (tokenSymbol.toUpperCase() === chain.nativeCurrency.symbol) {
                        const balance = await provider.getBalance(validatedWallet);
                        const formattedBalance = formatEther(balance);

                        return {
                            success: true,
                            toolData: {
                                type: 'balance',
                                data: {
                                    balance: `${formattedBalance} ${chain.nativeCurrency.symbol}`,
                                    wallet: validatedWallet,
                                    chainId,
                                    isNative: true
                                }
                            },
                            message: `Balance of ${validatedWallet} on ${chain.name} is ${formattedBalance} ${chain.nativeCurrency.symbol}`
                        };
                    }

                    const resolveResult = await resolveToken.handler({ 
                        symbol: tokenSymbol.toUpperCase(), 
                        chainId 
                    });

                    if (!resolveResult.success) {
                        return {
                            success: false,
                            error: {
                                type: 'EXECUTION_ERROR',
                                message: resolveResult.message,
                                details: { tokenSymbol, chainId }
                            },
                            requiresLLMProcessing: true
                        };
                    }

                    tokenAddress = resolveResult.data.address;
                } else if (!tokenAddress) {
                    return {
                        success: false,
                        error: {
                            type: 'VALIDATION_ERROR',
                            message: 'Please provide either a token symbol or token address to check the balance.',
                            details: { tokenSymbol, tokenAddress }
                        },
                        requiresLLMProcessing: true
                    };
                }

                const validatedToken = getAddress(tokenAddress as string);
                const contract = new Contract(validatedToken, ERC20_ABI, provider);
                
                try {
                    const [decimals, symbol, balance] = await Promise.all([
                        contract.decimals().catch(() => 18),
                        contract.symbol(),
                        contract.balanceOf(validatedWallet)
                    ]);

                    const formattedBalance = formatUnits(balance, decimals);

                    return {
                        success: true,
                        toolData: {
                            type: 'balance',
                            data: {
                                balance: `${formattedBalance} ${tokenSymbol || symbol}`,
                                wallet: validatedWallet,
                                chainId,
                                tokenAddress: validatedToken,
                                tokenSymbol: tokenSymbol || symbol,
                                isNative: false
                            }
                        },
                        message: `Balance of ${validatedWallet} on ${chain.name} is ${formattedBalance} ${tokenSymbol || symbol}`
                    };
                } catch (error: any) {
                    if (error.type) throw error;
                    
                    if (error.code === 'BAD_DATA') {
                        return {
                            success: false,
                            error: {
                                type: 'EXECUTION_ERROR',
                                message: `I'm having trouble with this token contract. Let me help you verify the token details.`,
                                details: { error: error.message }
                            },
                            requiresLLMProcessing: true
                        };
                    }

                    return {
                        success: false,
                        error: {
                            type: 'EXECUTION_ERROR',
                            message: `I encountered an issue while checking the balance. Let me help you verify everything.`,
                            details: { error: error.message }
                        },
                        requiresLLMProcessing: true
                    };
                }
            } catch (error: any) {
                if (error.code === 'INVALID_ARGUMENT') {
                    return {
                        success: false,
                        error: {
                            type: 'VALIDATION_ERROR',
                            message: `The address format doesn't look right. Let me help you verify it.`,
                            details: { error: error.message }
                        },
                        requiresLLMProcessing: true
                    };
                }
                throw error;
            }
        } catch (error: any) {
            return {
                success: false,
                error: {
                    type: 'EXECUTION_ERROR',
                    message: error.message || 'I encountered an unexpected issue. Let me help you figure out what went wrong.',
                    details: error
                },
                requiresLLMProcessing: true
            };
        }
    }
};