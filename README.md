<p align="left">
  <img src="https://raw.githubusercontent.com/lunark-ai/lunark-web/main/public/images/icons/icon-light.svg" alt="Lunark AI Logo" width="120" />
</p>

Lunark AI is a TypeScript-based AI companion platform designed to provide intelligent blockchain-native assistance. Built on a modern stack with powerful LLM integration and blockchain capabilities.

## ✨ Features

- **OpenAI Integration**: Powered by OpenAI's GPT models for intelligent responses
- **Future Model Support**: Infrastructure ready for Anthropic and Google AI models
- **Contextual Memory**: Long-term conversation memory with smart context management
- **Tool Execution**: Autonomous agent with ability to execute blockchain operations
- **RAG Capabilities**: Retrieval Augmented Generation for enhanced responses
- **Intent Recognition**: Understand and process complex user requests
- **Stream Processing**: Real-time streaming responses with dynamic content generation
- **Agent Framework**: Autonomous agents that can perform tasks and research
- **Web3 Integration**: Complete blockchain transaction capability with ethers.js
- **Multi-chain Support**: Cross-chain operations across various EVM networks
- **Token Management**: Token information, balances, and transaction capabilities
- **Smart Contract Interaction**: Tools for interacting with on-chain protocols
- **Wallet Management**: Secure wallet connection and transaction handling

## 🛠️ Technical Stack

- **Language**: TypeScript for type-safe development
- **Runtime**: Node.js for server-side execution
- **API**: Express.js for RESTful endpoints
- **Database**: PostgreSQL with Prisma ORM
- **Real-time**: Socket.IO for WebSocket communication
- **Security**: JWT authentication, rate limiting, input sanitization

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or later)
- Yarn package manager
- PostgreSQL database

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/lunark-ai/lunark.git
   cd lunark
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

3. Set up environment variables:
   Copy `.env.example` to `.env` and fill in the required values:
   ```bash
   cp .env.example .env
   ```

4. Generate Prisma client:
   ```bash
   yarn prisma:generate
   ```

5. Run database migrations:
   ```bash
   yarn prisma:migrate
   ```

6. Build and start the server:
   ```bash
   yarn build
   yarn start
   ```

Your server should now be running at the port specified in the .env file (default: 4545).

## 🔧 Environment Variables

Create a `.env` file with these variables:

```
DATABASE_URL=postgres://username:password@host:port/database
API_KEY=your_api_key
ADMIN_API_KEY=your_admin_api_key
APP_URL=http://localhost:3000
OPENAI_API_KEY=your_openai_key
EMBEDDING_API_KEY=your_embedding_key
ENCRYPTION_KEY=your_encryption_key
JWT_SECRET=your_jwt_secret
AGENT_PRIVATE_KEY=your_agent_private_key
NODE_ENV=development
CMC_API_KEY=your_coinmarketcap_key
PORT=4545
```

## 📖 Project Structure

```
lunark/
├── src/                  # Source code
│   ├── api/              # API routes and controllers
│   ├── common/           # Shared utilities and helpers
│   ├── config/           # Configuration files
│   ├── core/             # Core business logic
│     ├── agent/          # Autonomous agent system
│     ├── assistant/      # Assistant message handling
│     ├── llm/            # LLM integrations and factory
│     ├── memory/         # Conversation memory system
│     ├── rag/            # Retrieval Augmented Generation
│     ├── tools/          # Tool definitions and handlers
│   ├── infrastructure/   # External services integration
│   ├── types/            # TypeScript type definitions
│   └── app.ts            # Main application entry point
├── prisma/               # Prisma schema and migrations
├── scripts/              # Utility scripts
└── dist/                 # Compiled JavaScript code
```

## 💡 AI Assistant Features

The Lunark AI Assistant provides:

- **Conversational Interface**: Natural language understanding and generation
- **Blockchain Operations**: Execute transactions, check balances, swap tokens
- **Cross-chain Functionality**: Bridge assets and interact across networks
- **Market Data**: Access to cryptocurrency pricing and market information
- **Error Handling**: AI-driven error analysis and user-friendly explanations
- **Learning Capability**: Adaptive responses based on user interactions

## 📝 Available Commands

- `yarn build`: Build the TypeScript source
- `yarn start`: Start the server
- `yarn s`: Build and start in one command
- `yarn prisma:generate`: Generate Prisma client
- `yarn prisma:migrate`: Run database migrations
- `yarn prisma:studio`: Launch Prisma Studio UI
- `yarn db:backup`: Backup the database
- `yarn db:restore`: Restore from a backup
- `yarn load:tokens`: Load token data into the database

## 🛠️ API Overview

The API provides endpoints for:

- User authentication and management
- AI chat conversations
- Wallet connections and transactions
- Token information and balances
- Application settings and preferences

For detailed API documentation, see [API.md](API.md) or run the server and visit `/api/docs`.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📬 Contact

Lunark AI Team - [https://lunarkai.org](https://lunarkai.org)

Project Link: [https://github.com/lunark-ai/lunark](https://github.com/lunark-ai/lunark) 