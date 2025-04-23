import { ASSISTANT_CONFIG } from '@/config/assistant.config';
import { OpenAI } from 'openai';

let embeddingClient: OpenAI | null = null;

function initializeEmbeddingClient() {
    if (!embeddingClient) {
        embeddingClient = new OpenAI({
            apiKey: process.env.EMBEDDING_API_KEY
        });
    }
    return embeddingClient;
}

export async function generateEmbedding(text: string): Promise<number[]> {
    try {
        const openai = initializeEmbeddingClient();
        
        const response = await openai.embeddings.create({
            model: ASSISTANT_CONFIG.MODELS.EMBEDDING,
            input: text.substring(0, 8000),
            encoding_format: "float"
        });

        return response.data[0].embedding;
    } catch (error) {
        console.error('Error generating embedding:', error);
        throw error;
    }
} 