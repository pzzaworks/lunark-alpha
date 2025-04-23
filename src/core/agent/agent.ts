import { ITask, Node, createGraph, updateNodeStatus, getGraphStatus, getExecutableNodes } from './graph';
import { log } from '../../common/utils/log';
import { store, recall, IMemory } from '../memory/memory';
import { AGENT_CONFIG } from '@/config/agent.config';
import * as rag from '../rag/rag';
import { llmFactory, LLMMessage, LLMConfig } from '../llm/factory';

export interface IAgentState {
    activeTasks: Map<string, string>;
    memory: Record<string, any>;
    resources: any[];
}

export interface IAgentStatus {
    isRunning: boolean;
    startTime: Date;
    processedSteps: number;
    lastActivity: Date;
    currentTasks: string[];
}

let state: IAgentState = {
    activeTasks: new Map(),
    memory: {},
    resources: []
};

let status: IAgentStatus = {
    isRunning: false,
    startTime: new Date(),
    processedSteps: 0,
    lastActivity: new Date(),
    currentTasks: []
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]);
}

async function conductResearch(node: Node, task: ITask) {
    const startTime = Date.now();

    try {
        const [documents, memories] = await Promise.all([
            withTimeout(
                rag.searchDocuments(node.data, task.chatId),
                AGENT_CONFIG.AGENT.TIMEOUT_DURATION / 2
            ),
            withTimeout(
                recall({
                    userId: task.createdBy,
                    chatId: task.chatId,
                    type: 'RESEARCH_RESULT',
                    minImportance: AGENT_CONFIG.MEMORY.MIN_IMPORTANCE
                }),
                AGENT_CONFIG.AGENT.TIMEOUT_DURATION / 2
            )
        ]);

        const researchPrompt = `
            Research Task: ${node.data}
            Context:
            Task Description: ${task.description}
            Previous Research: ${(memories as IMemory[]).map(m => m.content).join('\n')}
            Available Documents: ${documents.map(d => d.content).join('\n')}
            [Research prompt details]
        `;

        const llmService = await llmFactory.createLLMService(AGENT_CONFIG.MODELS.CHAT);
        const messages: LLMMessage[] = [
            { role: 'user', content: researchPrompt }
        ];
        const config: LLMConfig = {
            model: AGENT_CONFIG.MODELS.CHAT,
            temperature: 0.7
        };

        let research = '';
        for await (const response of await llmService.generateResponse(messages, config)) {
            if (response.hasContent) {
                research = response.content;
            }
        }

        await storeResearchMemory(research, task);

        return {
            type: 'RESEARCH',
            output: research,
            sources: documents.length,
            relatedMemories: memories.length,
            executionTime: Date.now() - startTime
        };

    } catch (error) {
        throw error;
    }
}

async function analyzeData(node: Node, task: ITask) {
    try {
        const memories = await recall({
            userId: task.createdBy,
            chatId: task.chatId,
            type: 'ANALYSIS_INPUT',
            minImportance: AGENT_CONFIG.MEMORY.MIN_IMPORTANCE
        });

        const analysisPrompt = `
            Analysis Task: ${node.data}
            Context:
            Task Description: ${task.description}
            Available Data:
            ${(memories as IMemory[]).map(m => `${m.type}: ${m.content}`).join('\n')}
            [Analysis prompt details]
        `;

        const llmService = await llmFactory.createLLMService(AGENT_CONFIG.MODELS.CHAT);
        const messages: LLMMessage[] = [
            { role: 'user', content: analysisPrompt }
        ];
        const config: LLMConfig = {
            model: AGENT_CONFIG.MODELS.CHAT
        };

        let analysis = '';
        for await (const response of await llmService.generateResponse(messages, config)) {
            if (response.hasContent) {
                analysis = response.content;
            }
        }

        await storeAnalysisMemory(analysis, task);

        return {
            type: 'ANALYSIS',
            output: analysis,
            analyzedMemories: memories.length
        };

    } catch (error) {
        throw error;
    }
}

async function makeDecision(node: Node, task: ITask) {

    try {
        const memories = await recall({
            userId: task.createdBy,
            chatId: task.chatId,
            type: 'DECISION_INPUT',
            minImportance: AGENT_CONFIG.MEMORY.MIN_IMPORTANCE
        });

        const decisionPrompt = `
            Decision Required: ${node.data}
            Context:
            Task Description: ${task.description}
            Available Information:
            ${(memories as IMemory[]).map(m => `${m.type}: ${m.content}`).join('\n')}
            [Decision prompt details]
        `;

        const llmService = await llmFactory.createLLMService(AGENT_CONFIG.MODELS.CHAT);
        const messages: LLMMessage[] = [
            { role: 'user', content: decisionPrompt }
        ];
        const config: LLMConfig = {
            model: AGENT_CONFIG.MODELS.CHAT
        };

        let decision = '';
        for await (const response of await llmService.generateResponse(messages, config)) {
            if (response.hasContent) {
                decision = response.content;
            }
        }


        await storeDecisionMemory(decision, task);

        return {
            type: 'DECISION',
            output: decision,
            consideredMemories: memories.length
        };

    } catch (error) {
        throw error;
    }
}

async function validateResults(node: Node, task: ITask) {
    try {
        const memories = await recall({
            userId: task.createdBy,
            chatId: task.chatId,
            type: 'VALIDATION_INPUT',
            minImportance: AGENT_CONFIG.MEMORY.MIN_IMPORTANCE
        });

        const validationPrompt = `
            Validation Task: ${node.data}
            Context:
            Task Description: ${task.description}
            Results to Validate:
            ${(memories as IMemory[]).map(m => `${m.type}: ${m.content}`).join('\n')}
            [Validation prompt details]
        `;

        const llmService = await llmFactory.createLLMService(AGENT_CONFIG.MODELS.CHAT);
        const messages: LLMMessage[] = [
            { role: 'user', content: validationPrompt }
        ];
        const config: LLMConfig = {
            model: AGENT_CONFIG.MODELS.CHAT
        };

        let validation = '';
        for await (const response of await llmService.generateResponse(messages, config)) {
            if (response.hasContent) {
                validation = response.content;
            }
        }

        await storeValidationMemory(validation, task);

        return {
            type: 'VALIDATION',
            output: validation,
            validatedItems: memories.length
        };

    } catch (error) {
        throw error;
    }
}

async function executeTask(task: ITask) {

    try {
        const taskGraph = await createGraph();
        if (!taskGraph) {
            throw new Error('Failed to create task graph');
        }

        state.activeTasks.set(task.id, taskGraph.id);

        const graphStatus = await getGraphStatus(taskGraph.id);

        if (graphStatus.failed > 0) {
            throw new Error('Task graph initialization failed');
        }

        const executableNodes = await getExecutableNodes(taskGraph.id);

        if (executableNodes.length === 0) {
            throw new Error('No executable nodes found');
        }

        await Promise.all(executableNodes.map((node: Node) => executeNode(node, task)));

        const finalStatus = await getGraphStatus(taskGraph.id);

        return finalStatus;

    } catch (error) {
        throw error;
    }
}

async function storeResearchMemory(research: string, task: ITask) {
    await store({
        content: research,
        type: 'RESEARCH_RESULT',
        userId: task.createdBy,
        chatId: task.chatId,
        importance: 0.8,
        timestamp: new Date()
    });
}

async function storeAnalysisMemory(analysis: string, task: ITask) {
    await store({
        content: analysis,
        type: 'ANALYSIS_INPUT',
        userId: task.createdBy,
        chatId: task.chatId,
        importance: 0.7,
        timestamp: new Date()
    });
}

async function storeDecisionMemory(decision: string, task: ITask) {
    await store({
        content: decision,
        type: 'DECISION_INPUT',
        userId: task.createdBy,
        chatId: task.chatId,
        importance: 0.9,
        timestamp: new Date()
    });
}

async function storeValidationMemory(validation: string, task: ITask) {
    await store({
        content: validation,
        type: 'VALIDATION_INPUT',
        userId: task.createdBy,
        chatId: task.chatId,
        importance: 0.8,
        timestamp: new Date()
    });
}

async function storeActionMemory(actionSummary: string, task: ITask) {
    await store({
        content: actionSummary,
        type: 'ACTION_RESULT',
        userId: task.createdBy,
        chatId: task.chatId,
        importance: 0.9,
        timestamp: new Date()
    });
}

async function executeNode(node: Node, task: ITask) {
    let retries = 0;

    while (retries < AGENT_CONFIG.AGENT.MAX_RETRIES) {
        try {
            
            await updateNodeStatus(node.id, 'IN_PROGRESS');
            
            const result = await withTimeout(
                executeNodeByType(node, task),
                AGENT_CONFIG.AGENT.TIMEOUT_DURATION
            );
            
            await updateNodeStatus(node.id, 'COMPLETED', result);

            return result;

        } catch (error) {
            retries++;

            if (retries === AGENT_CONFIG.AGENT.MAX_RETRIES) {
                await updateNodeStatus(node.id, 'FAILED', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    failedAt: new Date()
                });
                throw error;
            }
            
            const delay = AGENT_CONFIG.AGENT.NODE_RETRY_DELAY * Math.pow(2, retries - 1);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw new Error('Max retries exceeded');
}

async function executeNodeByType(node: Node, task: ITask) {
    
    try {
        switch (node.type) {
            case 'RESEARCH':
                return await conductResearch(node, task)
            case 'ANALYSIS':
                return await analyzeData(node, task)
            case 'DECISION':
                return await makeDecision(node, task)
            case 'VALIDATION':
                return await validateResults(node, task)
            default:
                throw new Error(`Unknown node type: ${node.type}`)
        }
    } catch (error) {
        throw error;
    }
}

function startAgent(): void {
    if (status.isRunning) {
        return;
    }

    status.isRunning = true;
    status.startTime = new Date();
}

function stopAgent(): void {
    status.isRunning = false;
    status.lastActivity = new Date();
}

function getAgentStatus(): IAgentStatus {
    return { ...status };
}

function getAgentState(): IAgentState {
    return { ...state };
}

export {
    startAgent,
    stopAgent,
    getAgentStatus,
    getAgentState
};