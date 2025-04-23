import { getAddress, Contract, Interface, parseUnits, formatUnits, parseEther } from 'ethers';
import { AddressLike } from 'ethers';
import { log } from '@/common/utils/log';
import { getProvider } from '@/core/tools/provider';
import { chains, isChainSupported } from '@/core/networks/chains';
import { resolveToken } from './resolveToken';
import { ERC20_ABI } from '@/config/abi';
import { Tool } from '../tools';
import { resolveContact } from './resolveContact';

interface TransferArgs {
    to?: AddressLike | string;
    userName?: string;
    amount: string;
    chainId: number;
    from?: AddressLike;
    tokenAddress?: AddressLike;
    tokenSymbol?: string;
    context?: {
        userId?: string;
        userAddress?: string;
    };
}

export const transfer: Tool<TransferArgs> = {
    name: 'transfer',
    definition: {
        type: 'function',
        function: {
            name: 'transfer',
            description: 'Transfer tokens (native or ERC20) to an address or username',
            parameters: {
                type: 'object',
                properties: {
                    to: {
                        type: 'string',
                        pattern: '^0x[a-fA-F0-9]{40}$',
                        description: 'The recipient address',
                    },
                    userName: {
                        type: 'string',
                        description: 'The username or contact name to send tokens to'
                    },
                    amount: {
                        type: 'string',
                        description: 'The exact amount to transfer as specified by the user (e.g. "1" for 1 token). DO NOT modify or add decimals.',
                    },
                    chainId: {
                        type: 'number',
                        description: 'The chain ID of the network',
                    },
                    from: {
                        type: 'string',
                        pattern: '^0x[a-fA-F0-9]{40}$',
                        description: 'The address of the user making the transfer',
                    },
                    tokenAddress: {
                        type: 'string',
                        pattern: '^0x[a-fA-F0-9]{40}$',
                        description: 'The ERC20 token contract address. If not provided, native token transfer will be used.',
                    },
                    tokenSymbol: {
                        type: 'string',
                        description: 'The token symbol',
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
                required: ['amount', 'chainId', 'from']
            }
        }
    },
    instructions: `"transfer": Creates a token transfer transaction (works for both native and ERC20 tokens).`,
    supportedChains: [
        1,      
        17000,  
        56,     
        137,    
        43114,  
        42161,  
        10,     
        250,    
        8453,   
        // 324,    
        1088,   
        42220,  
        25,     
        100,    
        2222,   
        5000    
    ],
    handler: async ({ to, userName, amount, chainId, from, tokenAddress, tokenSymbol, context }: TransferArgs) => {
        try {
            if (!transfer.supportedChains?.includes(chainId)) {
                return {
                    success: false,
                    error: {
                        type: 'WRONG_CHAIN',
                        message: `The requested operation is not supported on ${chains[chainId].name} network (Chain ID: ${chainId}). Let me help you find a supported network.`,
                        supportedChains: transfer.supportedChains,
                        currentChain: chainId
                    },
                    requiresLLMProcessing: true
                };
            }

            try {
                // Prioritize userName over direct address if both are provided
                let resolvedTo: string;
                let validatedTo: string;

                if (userName) {
                    // If userName is provided, use it regardless of whether 'to' address is provided
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

                    resolvedTo = contactResult.data.address;
                    try {
                        validatedTo = getAddress(resolvedTo);
                    } catch (error) {
                        return {
                            success: false,
                            error: {
                                type: 'VALIDATION_ERROR',
                                message: `The contact's address appears to be invalid. Please verify the contact's address.`,
                                details: { error, resolvedTo }
                            },
                            requiresLLMProcessing: true
                        };
                    }
                } else if (to && !to.toString().startsWith('0x')) {
                    // Handle case where 'to' might be a username
                    const contactResult = await resolveContact.handler({
                        name: to.toString(),
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

                    resolvedTo = contactResult.data.address;
                    try {
                        validatedTo = getAddress(resolvedTo);
                    } catch (error) {
                        return {
                            success: false,
                            error: {
                                type: 'VALIDATION_ERROR',
                                message: `The contact's address appears to be invalid. Please verify the contact's address.`,
                                details: { error, resolvedTo }
                            },
                            requiresLLMProcessing: true
                        };
                    }
                } else if (to) {
                    // Only use direct address if no username is provided
                    resolvedTo = to.toString();
                    try {
                        validatedTo = getAddress(resolvedTo);
                    } catch (error) {
                        return {
                            success: false,
                            error: {
                                type: 'VALIDATION_ERROR',
                                message: `The provided address is invalid. Please verify the address format.`,
                                details: { error, resolvedTo }
                            },
                            requiresLLMProcessing: true
                        };
                    }
                } else {
                    return {
                        success: false,
                        error: {
                            type: 'VALIDATION_ERROR',
                            message: 'Please provide either a recipient address or a username.',
                            details: { to, userName }
                        },
                        requiresLLMProcessing: true
                    };
                }

                let validatedUser: string;
                try {
                    validatedUser = getAddress(from?.toString() || '');
                } catch (error) {
                    return {
                        success: false,
                        error: {
                            type: 'VALIDATION_ERROR',
                            message: `Your wallet address appears to be invalid. Please verify your wallet connection.`,
                            details: { error, from }
                        },
                        requiresLLMProcessing: true
                    };
                }

                const amountValue = amount.replace(/[^0-9.]/g, '');
                
                const isNative = !tokenSymbol || 
                               tokenSymbol.toLowerCase() === 'eth' ||
                               Object.values(chains).some(
                                   chain => chain.nativeCurrency.symbol.toLowerCase() === tokenSymbol?.toLowerCase()
                               );

                if (isNative) {
                    return await createNativeTransfer(validatedTo, amountValue, chainId);
                }

                if (tokenSymbol) {
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

                    tokenAddress = resolveResult.data.address as AddressLike;
                } else if (!tokenAddress) {
                    return {
                        success: false,
                        error: {
                            type: 'VALIDATION_ERROR',
                            message: 'Please provide either a token symbol or token address for the transfer.',
                            details: { tokenSymbol, tokenAddress }
                        },
                        requiresLLMProcessing: true
                    };
                }

                const validatedToken = getAddress(tokenAddress.toString());
                const provider = await getProvider(chainId);
                const contract = new Contract(validatedToken, ERC20_ABI, provider);
                
                try {
                    const [decimals, symbol, balance] = await Promise.all([
                        contract.decimals().catch(() => 18),
                        contract.symbol(),
                        contract.balanceOf(validatedUser)
                    ]);

                    const amountWithDecimals = parseUnits(amountValue, decimals);

                    if (balance < amountWithDecimals) {
                        return {
                            success: false,
                            error: {
                                type: 'EXECUTION_ERROR',
                                message: `It looks like you don't have enough ${tokenSymbol || symbol}. Your balance is ${formatUnits(balance, decimals)} ${tokenSymbol || symbol}, but you're trying to send ${amountValue} ${tokenSymbol || symbol}.`,
                                details: { 
                                    balance: formatUnits(balance, decimals),
                                    requestedAmount: amountValue,
                                    symbol: tokenSymbol || symbol
                                }
                            },
                            requiresLLMProcessing: true
                        };
                    }

                    return await createERC20Transfer(validatedTo, amountWithDecimals.toString(), validatedToken, chainId, decimals, tokenSymbol || symbol);
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
                            message: `I encountered an issue while preparing the transfer. Let me help you verify everything.`,
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

async function createNativeTransfer(to: AddressLike, amount: string, chainId: number) {
    if (!isChainSupported(chainId)) {
        throw new Error(`Chain ID ${chainId} is not supported`);
    }

    const nativeSymbol = chains[chainId].nativeCurrency.symbol;
    const valueInWei = parseEther(amount);

    const transaction = { 
        to: getAddress(to.toString()),
        value: valueInWei.toString(),
        chainId,
        data: '0x',
    };

    const validatedTo = getAddress(to.toString());
    return {
        transaction,
        chainId, 
        buttonText: `Send ${amount} ${nativeSymbol}`,
        message: `I've prepared a transaction to send ${amount} ${nativeSymbol} to the address ${validatedTo} on ${chains[chainId].name} network.` 
    };
}

async function createERC20Transfer(
    to: AddressLike, 
    amount: string, 
    tokenAddress: AddressLike, 
    chainId: number,
    decimals: number,
    symbol: string
) {
    if (!isChainSupported(chainId)) {
        throw new Error(`Chain ID ${chainId} is not supported`);
    }

    const erc20Interface = new Interface(ERC20_ABI);
    const validatedTo = getAddress(to.toString());
    const data = erc20Interface.encodeFunctionData('transfer', [validatedTo, amount]);

    const transaction = {
        to: getAddress(tokenAddress.toString()),
        value: '0',
        chainId,
        data,
    };

    const formattedAmount = formatUnits(amount, decimals);
    return {
        transaction,
        chainId,
        buttonText: `Send ${formattedAmount} ${symbol}`,
        message: `I've prepared a transaction to send ${formattedAmount} ${symbol} tokens to the address ${validatedTo} on ${chains[chainId].name} network.`
    };
}