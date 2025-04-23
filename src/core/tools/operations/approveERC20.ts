import { AddressLike, Interface, Contract, parseUnits, getAddress, formatUnits } from 'ethers';
import { isChainSupported, chains } from '@/core/networks/chains';
import { Tool } from '../tools';
import { log } from '@/common/utils/log';
import prisma from '@/infrastructure/database/prisma';
import { getProvider } from '@/core/tools/provider';
import { resolveToken } from './resolveToken';

interface ApproveERC20Args {
    spender: string;
    amount: string;
    tokenAddress?: string;
    tokenSymbol?: string;
    chainId: number;
}

interface ApproveERC20Error {
    type: 'INSUFFICIENT_BALANCE' | 'INVALID_ADDRESS' | 'NETWORK_ERROR' | 'TOKEN_ERROR' | 'GENERAL_ERROR' | 'WRONG_CHAIN' | 'VALIDATION_ERROR' | 'EXECUTION_ERROR';
    message: string;
    details?: any;
}

const ERC20_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function balanceOf(address owner) view returns (uint256)',
];

export const approveERC20: Tool<ApproveERC20Args> = {
    name: 'approve_erc20',
    definition: {
        type: 'function',
        function: {
            name: 'approve_erc20',
            description: 'Approve ERC20 token spending for an address',
            parameters: {
                type: 'object',
                properties: {
                    spender: {
                        type: 'string',
                        pattern: '^0x[a-fA-F0-9]{40}$',
                        description: 'The spender address to approve',
                    },
                    amount: {
                        type: 'string',
                        description: 'The amount to approve in token units',
                    },
                    tokenAddress: {
                        type: 'string',
                        pattern: '^0x[a-fA-F0-9]{40}$',
                        description: 'The ERC20 token contract address',
                    },
                    tokenSymbol: {
                        type: 'string',
                        description: 'The token symbol to approve',
                    },
                    chainId: {
                        type: 'number',
                        description: 'The chain ID of the network',
                    }
                },
                required: ['spender', 'amount', 'chainId']
            }
        }
    },
    instructions: `"approve_erc20": Creates an ERC20 token approval transaction.`,
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
    handler: async ({ spender, amount, tokenAddress, tokenSymbol, chainId }: ApproveERC20Args) => {
        try {
            if (!approveERC20.supportedChains?.includes(chainId)) {
                return {
                    success: false,
                    error: {
                        type: 'WRONG_CHAIN',
                        message: `The requested operation is not supported on ${chains[chainId].name} network (Chain ID: ${chainId}). Let me help you find a supported network.`,
                        supportedChains: approveERC20.supportedChains,
                        currentChain: chainId
                    },
                    requiresLLMProcessing: true
                };
            }

            try {
                const validatedSpender = getAddress(spender.toString());
                
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

                    tokenAddress = resolveResult.data.address;
                } else if (!tokenAddress) {
                    return {
                        success: false,
                        error: {
                            type: 'VALIDATION_ERROR',
                            message: 'Please provide either a token symbol or token address for the approval.',
                            details: { tokenSymbol, tokenAddress }
                        },
                        requiresLLMProcessing: true
                    };
                }

                const validatedToken = getAddress(tokenAddress as string);

                const provider = await getProvider(chainId);
                const contract = new Contract(validatedToken, ERC20_ABI, provider);

                const [decimals, symbol] = await Promise.all([
                    contract.decimals().catch(() => 18),
                    contract.symbol()
                ]);

                if (tokenSymbol && symbol.toLowerCase() !== tokenSymbol.toLowerCase()) {
                    return {
                        success: false,
                        error: {
                            type: 'VALIDATION_ERROR',
                            message: `There seems to be a mismatch. You requested to approve ${tokenSymbol.toUpperCase()}, but I found ${symbol}. Let me help you verify the correct token.`,
                            details: { requestedSymbol: tokenSymbol, actualSymbol: symbol }
                        },
                        requiresLLMProcessing: true
                    };
                }

                const amountWithDecimals = parseUnits(amount, decimals);
                return await createERC20Approve(validatedSpender, amount, validatedToken, chainId, decimals, symbol);

            } catch (error: any) {
                if (error.code === 'INVALID_ARGUMENT') {
                    return {
                        success: false,
                        error: {
                            type: 'VALIDATION_ERROR',
                            message: `Invalid Ethereum address provided. Let me help you verify the addresses.`,
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
                    message: error.message || 'An unexpected error occurred during the approval. Let me help you figure out what went wrong.',
                    details: error
                },
                requiresLLMProcessing: true
            };
        }
    }
};

async function createERC20Approve(
    spender: AddressLike, 
    amount: string, 
    tokenAddress: AddressLike, 
    chainId: number,
    decimals: number,
    symbol: string
) {
    if (!isChainSupported(chainId)) {
        throw new Error(`Chain ID ${chainId} is not supported`);
    }

    const amountWithDecimals = parseUnits(amount, decimals);

    const erc20Interface = new Interface(ERC20_ABI);
    const data = erc20Interface.encodeFunctionData('approve', [spender, amountWithDecimals]);

    const transaction = {
        to: tokenAddress,
        value: '0',
        chainId,
        data,
    };

    return {
        transaction,
        chainId,
        buttonText: `Approve ${amount} ${symbol}`,
        message: `I've prepared a transaction to approve ${amount} ${symbol} tokens for the address ${spender} on ${chains[chainId].name} network.`
    };
} 