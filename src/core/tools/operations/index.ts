import { Tool as BaseTool } from '../tools';

import { approveERC20 } from './approveERC20';
import { getBalance } from './getBalance';
import { isNativeToken } from './isNativeToken';
import { resolveToken } from './resolveToken';
import { storeMemory } from './storeMemory';
import { switchNetwork } from './switchNetwork';
import { transfer } from './transfer';
import { listTools } from './listTools';
import { addContact } from './addContact';
import { updateContact } from './updateContact';
import { deleteContact } from './deleteContact';
import { listContacts } from './listContacts';
import { resolveContact } from './resolveContact';

export interface ToolError {
    type: string;
    message: string;
    requiresLLMProcessing?: boolean;
    details?: any;
}

export interface ToolResult {
    success?: boolean;
    error?: ToolError;
    message?: string;
    toolData?: any;
}

export interface Tool<T = any> extends BaseTool<T> {}

export const tools: Tool[] = [
  approveERC20,
  getBalance,
  isNativeToken,
  resolveToken,
  storeMemory,
  switchNetwork,
  transfer,
  listTools,
  addContact,
  updateContact,
  deleteContact,
  listContacts,
  resolveContact
]; 

export function handleToolError(error: any): ToolResult {
    if (error.requiresLLMProcessing) {
        return {
            success: false,
            error,
            message: error.message
        };
    }
    
    return {
        success: false,
        error: {
            type: 'UNKNOWN_ERROR',
            message: error.message || 'An unexpected error occurred',
            requiresLLMProcessing: true
        }
    };
} 