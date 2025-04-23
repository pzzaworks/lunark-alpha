export const AGENT_CONFIG = {
    DEFAULT_CHAIN_ID: 17000,
    DEFAULT_USER_ID: '75830ade-7c77-4468-a6f5-fd3d66361b02',
    MODELS: {
      CHAT: 'openai/gpt-4o-mini'
    },
    AGENT: {
      CONCURRENT_TASKS_LIMIT: 5,
      MAX_RETRIES: 3,
      CHECK_INTERVAL: 5000,
      NODE_RETRY_DELAY: 1000,
      RETRY_DELAY: 2000,          
      TIMEOUT_DURATION: 300000,
      TOOL_TIMEOUT_DURATION: 60000,
      MAX_SHORT_TERM_MEMORY: 10,
      MAX_TOTAL_TOKENS: 4000
    },
    NODE_TYPES: {
      RESEARCH: 'RESEARCH',
      ANALYSIS: 'ANALYSIS',
      ACTION: 'ACTION',
      DECISION: 'DECISION',
      VALIDATION: 'VALIDATION',
    },
    EDGE_TYPES: {
      FLOW: 'flow',
      MEMORY_FLOW: 'memory_flow'
    },
    MEMORY: {
      MIN_IMPORTANCE: 0.7,
      MAX_RESULTS: 5
    }
}