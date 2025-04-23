import { Tool } from '../tools';
import { tools } from '.';
import { log } from '@/common/utils/log';
import { openaiService } from '@/core/llm/openai';
import { ASSISTANT_CONFIG } from '@/config/assistant.config';

interface ListToolsArgs {
    // No arguments needed
}

export const listTools: Tool<ListToolsArgs> = {
    name: 'list_tools',
    definition: {
        type: 'function',
        function: {
            name: 'list_tools',
            description: 'Lists all available tools that Lunark AI can use with their names and descriptions',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        }
    },
    instructions: `"list_tools": Lists all available tools with their names and descriptions to help users understand what commands they can use.`,
    handler: async () => {
        try {
            const toolList = tools.map(tool => ({
                name: tool.name,
                description: tool.definition.function.description
            }));

            // Generate a natural message using LLM that incorporates all tools
            const toolDescriptions = toolList.map(tool => `${tool.name}: ${tool.description}`).join('\n');
            
            const messages = [{
                role: 'system' as const,
                content: 'Create a concise message that naturally introduces your capabilities based on the all available tools. Keep it short, incluede all tools and concise. And start with "I can help you with various tasks related to blockchain! Whether you need to..."'
            }, {
                role: 'user' as const,
                content: `Here are my available tools:\n${toolDescriptions}\n\nCreate a natural, friendly message introducing these capabilities.`
            }];

            let generatedMessage = '';
            for await (const response of openaiService.generateResponse(messages, { 
                model: ASSISTANT_CONFIG.MODELS.CHAT,
                temperature: 0.7,
                maxTokens: 200
            })) {
                if (response.content) {
                    generatedMessage += response.content;
                }
            }

            return {
                success: true,
                message: generatedMessage,
                toolData: {
                    type: 'toolList',
                    data: {
                        tools: toolList
                    },
                    component: 'listTools',
                }
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    type: 'TOOL_LIST_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to list tools',
                    requiresLLMProcessing: true
                }
            };
        }
    }
}; 