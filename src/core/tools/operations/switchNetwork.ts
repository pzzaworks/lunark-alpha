import { chains } from "@/core/networks/chains";
import { Tool } from "../tools";

interface SwitchNetworkArgs {
    requiredChainId: number;
    currentChainId: number;
}

export const switchNetwork: Tool<SwitchNetworkArgs> = {
    name: 'switch_network',
    definition: {
        type: 'function',
        function: {
            name: 'switch_network',
            description: 'Switch the network when a token or operation is not supported on current network, or when user needs to change to a specific network. Use this when encountering WRONG_CHAIN errors or when a token is not available on current network.',
            parameters: {
                type: 'object',
                properties: {
                    requiredChainId: {
                        type: 'number',
                        description: 'The chain ID to switch to'
                    },
                    currentChainId: {
                        type: 'number',
                        description: 'The current chain ID user is connected to'
                    }
                },
                required: ['requiredChainId', 'currentChainId']
            }
        }
    },
    instructions: `"switch_network": Switches the connected wallet to the specified network. Use when token or operation is not available on current network.`,    
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
    handler: async ({ requiredChainId, currentChainId }: SwitchNetworkArgs) => {
        try {
            if (!chains[requiredChainId]) {
                return {
                    success: false,
                    error: {
                        type: 'VALIDATION_ERROR',
                        message: `Chain ID ${requiredChainId} is not supported. Let me help you find a supported network.`,
                        details: { 
                            requiredChainId,
                            supportedChains: Object.keys(chains).map(Number)
                        }
                    },
                    requiresLLMProcessing: true
                };
            }

            if (requiredChainId === currentChainId) {
                return {
                    success: true,
                    toolData: {
                        type: 'chainSwitch',
                        data: {
                            requiredChainId,
                            currentChainId
                        },
                        component: 'chainSwitch'
                    },
                    message: `Already on the correct network: ${chains[currentChainId].name}`
                };
            }

            return {
                success: true,
                toolData: {
                    type: 'chainSwitch',
                    data: {
                        requiredChainId,
                        currentChainId
                    },
                    component: 'chainSwitch'
                },
                message: `This operation requires switching to chain ${chains[requiredChainId].name}`
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    type: 'EXECUTION_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to process network switch. Let me help you troubleshoot.',
                    details: error
                },
                requiresLLMProcessing: true
            };
        }
    }
};