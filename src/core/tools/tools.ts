import { tools as operationTools } from './operations';
import { log } from '@/common/utils/log';
import { createLLMService, LLMMessage } from '@/core/llm/factory';
import { ASSISTANT_CONFIG } from '@/config/assistant.config';
import prisma from '@/infrastructure/database/prisma';

export interface Tool<T = any> {
  name: string;
  definition: {
      type: 'function';
      function: {
          name: string;
          description: string;
          parameters: {
              type: 'object';
              properties: Record<string, any>;
              required: string[];
          };
      };
  };
  instructions: string;
  triggers?: string[] | RegExp[] | (string | RegExp)[];
  supportedChains?: number[];
  handler: (args: T) => Promise<any>;
}

export interface ToolCall {
  name: string;
  arguments: any;
}

export interface ToolError {
  type: 'TOOL_NOT_FOUND' | 'WRONG_CHAIN' | 'EXECUTION_ERROR' | 'VALIDATION_ERROR';
  message: string;
  supportedChains?: number[];
  currentChain?: number;
  details?: any;
  originalError?: any;
}

export interface ToolResultData {
  success: boolean;
  message?: string;
  data?: any;
  error?: ToolError;
  transaction?: {
    id: string;
    hash: string | null;
    status: string;
  };
  requiresLLMProcessing?: boolean;
  toolData?: any;
}

export interface ToolResult {
  toolCall: ToolCall;
  result: string; // JSON stringified ToolResultData
}

export interface ToolContext {
  userId?: string;
  chatId?: string;
  messageId?: string;
  chainId?: number;
  userAddress?: string;
  [key: string]: any;
}

export const tools: Tool[] = operationTools;

async function processErrorWithLLM(error: ToolError, context: ToolContext): Promise<ToolResultData> {
  try {
    const userSettings = context.userId ? await prisma.userSettings.findUnique({
      where: { userId: context.userId }
    }) : null;
    
    const model = userSettings?.llmModel || ASSISTANT_CONFIG.MODELS.CHAT;
    const llmService = await createLLMService(model);
    
    const errorContext: LLMMessage[] = [
      {
        role: 'assistant',
        content: `You are a blockchain assistant helping users with network and token operations. Keep response under 2 sentences`
      },
      {
        role: 'user',
        content: `Error Details:
        - Type: ${error.type}
        - Message: ${error.message}
        - Network: ${context.chainId ? `Chain ID ${context.chainId}` : 'Unknown'}
        ${error.supportedChains ? `- Supported Networks: ${error.supportedChains.join(', ')}` : ''}
        ${error.details ? `- Additional Info: ${JSON.stringify(error.details)}` : ''}`
      }
    ];

    const response = await llmService.generateResponse(errorContext, {
      model,
      temperature: 0.7,
      maxTokens: 100,
    });

    let userFriendlyMessage = '';
    let toolData = null;
    
    for await (const chunk of response) {
      if (chunk.content) {
        userFriendlyMessage += chunk.content;
      }
      if (chunk.toolCalls?.length > 0) {
        const toolResults = await handleToolCalls(chunk.toolCalls.map(tc => ({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments)
        })), context);

        for (const result of toolResults) {
          const resultData = JSON.parse(result.result);
          if (resultData.success) {
            if (resultData.message) {
              userFriendlyMessage += ' ' + resultData.message;
            }
            if (resultData.toolData) {
              toolData = resultData.toolData;
            }
          }
        }
      }
    }

    userFriendlyMessage = userFriendlyMessage
      .replace(/\*\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const finalMessage = userFriendlyMessage || 'Unable to process the operation. Please try again or contact support.';

    return {
      success: false,
      message: finalMessage,
      toolData: {
        type: 'ERROR',
        error: {
          type: error.type,
          message: finalMessage,
          details: error.details
        },
        ...(toolData || {})
      }
    };
  } catch (llmError) {
    return {
      success: false,
      message: error.message,
      toolData: {
        type: 'ERROR',
        error: {
          type: error.type,
          message: error.message,
          details: error.details
        }
      }
    };
  }
}

export async function handleToolCalls(toolCalls: ToolCall[], context: ToolContext = {}): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  
  for (const toolCall of toolCalls) {
    try {
      const tool = tools.find(t => t.name === toolCall.name);
      if (!tool) {
        const error: ToolError = {
          type: 'TOOL_NOT_FOUND',
          message: `Tool ${toolCall.name} not found`
        };
        
        const result = await processErrorWithLLM(error, context);
        
        results.push({
          toolCall,
          result: JSON.stringify(result)
        });
        continue;
      }

      if (tool.name !== 'switch_network' && tool.supportedChains?.length) {
        const currentChainId = context.chainId || 1;
        if (!tool.supportedChains.includes(currentChainId)) {
          const error: ToolError = {
            type: 'WRONG_CHAIN',
            message: `This operation requires switching to one of these chains: ${tool.supportedChains.join(', ')}. Current chain: ${currentChainId}`,
            supportedChains: tool.supportedChains,
            currentChain: currentChainId
          };

          const result = await processErrorWithLLM(error, context);

          results.push({
            toolCall,
            result: JSON.stringify(result)
          });
          continue;
        }
      }
      
      try {
        const validationResult = validateToolArguments(tool, toolCall.arguments);
        if (!validationResult.success) {
          const error: ToolError = {
            type: 'VALIDATION_ERROR',
            message: validationResult.message || 'Invalid arguments',
            details: validationResult.details
          };

          const result = await processErrorWithLLM(error, context);

          results.push({
            toolCall,
            result: JSON.stringify(result)
          });
          continue;
        }
      } catch (validationError) {
        const error: ToolError = {
          type: 'VALIDATION_ERROR',
          message: validationError instanceof Error ? validationError.message : 'Validation failed',
          details: validationError
        };

        const result = await processErrorWithLLM(error, context);

        results.push({
          toolCall,
          result: JSON.stringify(result)
        });
        continue;
      }
      
      const result = await tool.handler(toolCall.arguments);
      
      if (result?.error) {
        const error: ToolError = {
          type: 'EXECUTION_ERROR',
          message: result.error.message || 'Tool execution failed',
          details: result.error,
          originalError: result.error
        };

        const resultData = await processErrorWithLLM(error, context);

        results.push({
          toolCall,
          result: JSON.stringify(resultData)
        });
      } else {
        results.push({
          toolCall,
          result: JSON.stringify({
            success: true,
            ...result
          } as ToolResultData)
        });
      }
    } catch (error) {
      const toolError: ToolError = {
        type: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error,
        originalError: error
      };

      const resultData = await processErrorWithLLM(toolError, context);
      
      results.push({
        toolCall,
        result: JSON.stringify(resultData)
      });
    }
  }
  
  return results;
}

interface ValidationResult {
  success: boolean;
  message?: string;
  details?: any;
}

function validateToolArguments(tool: Tool, args: any): ValidationResult {
  const required = tool.definition.function.parameters.required;
  const missing = required.filter(param => !(param in args));
  
  if (missing.length > 0) {
    return {
      success: false,
      message: `Missing required arguments: ${missing.join(', ')}`,
      details: { missing }
    };
  }

  // Add more validation as needed
  return { success: true };
} 