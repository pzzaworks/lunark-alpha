import { startAgent, stopAgent, getAgentStatus, getAgentState } from './agent'
import { AGENT_CONFIG } from '@/config/agent.config';
import * as taskService from './task'
import { v4 as uuidv4 } from 'uuid';
import { log } from '@/common/utils/log';
async function initializeAgent() {
  try {
    const blockchainTask = await taskService.createTask({
      title: "Blockchain Technology Research",
      description: `As an AI agent, I need to research and understand blockchain technology deeply. 
      My objectives are:
      1. Research fundamental blockchain concepts and architecture
      2. Analyze different consensus mechanisms (PoW, PoS, etc.)
      3. Investigate smart contracts and their applications
      4. Study real-world blockchain implementations
      5. Identify potential use cases and limitations
      
      For each topic:
      - Gather comprehensive information
      - Analyze technical aspects
      - Evaluate practical implications
      - Make decisions about most promising approaches
      - Validate findings and conclusions
      
      Please organize this into a workflow that ensures thorough understanding.`,
      createdBy: AGENT_CONFIG.DEFAULT_USER_ID,
      chatId: uuidv4(),
      priority: 1
    });

    startAgent();

    return blockchainTask;
  } catch (error) {
    throw error;
  }
}

export {
  startAgent,
  stopAgent,
  getAgentStatus,
  getAgentState,
  taskService,
  initializeAgent
};