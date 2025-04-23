import NodeCache from 'node-cache'
import prisma from '@/infrastructure/database/prisma';
import { encrypt, decrypt } from '@/common/utils/encrypt';
import { updateStatus } from '@/infrastructure/socket/handlers';
import { generateEmbedding } from '@/core/llm/embedding';

export interface IDocument {
  id: string;
  content: string;
  embedding: string;
  metadata?: string | null;
  createdAt: Date;
  updatedAt: Date;
  similarity?: number;
}

export interface Section {
  content: string;
  embedding: number[];
  startIndex: number;
  endIndex: number;
}

export interface DocumentSection {
  id: string;
  sections: Section[];
  metadata?: string;
}

const cache = new NodeCache({ stdTTL: 3600 })

function cosineSimilarity(a: number[], b: number[]): number {
  try {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
    return dotProduct / (magnitudeA * magnitudeB)
  } catch (error) {
    return 0
  }
}

async function generateDocumentEmbedding(text: string): Promise<number[]> {
    const cacheKey = `embedding:${text}`

    try {
        const cached = cache.get<number[]>(cacheKey)
        if (cached) {
            return cached
        }

        const embedding = await generateEmbedding(text);
        cache.set(cacheKey, embedding)
        return embedding
    } catch (error) {
        throw error
    }
}

export async function searchDocuments(query: string, chatId: string) {
    try {
        updateStatus(chatId, 'Searching for relevant documents...');
        
        const docCount = await prisma.document.count();
        if (docCount === 0) {
            return [];
        }

        const queryEmbedding = await generateDocumentEmbedding(query);
        const threshold = 0.7;
        const limit = 10; 
        
        const docs = await prisma.document.findMany({
            where: { chatId }
        });

        const relevantSections: Array<{
            docId: string;
            content: string;
            similarity: number;
            metadata?: string;
        }> = [];

        for (const doc of docs) {
            const sections: Section[] = JSON.parse(decrypt(doc.sections));
            
            for (const section of sections) {
                const similarity = cosineSimilarity(queryEmbedding, section.embedding);
                if (similarity >= threshold) {
                    relevantSections.push({
                        docId: doc.id,
                        content: section.content,
                        similarity,
                        metadata: doc.metadata ? decrypt(doc.metadata) : undefined
                    });
                }
            }
        }

        const results = relevantSections
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit)
            .map(({ similarity, ...section }) => section);

        updateStatus(chatId, 'Processing documents...');

        return results;
    } catch (error) {
        throw error;
    }
}

export async function addDocument(content: string, chatId: string, metadata?: string) {
    try {
        if (!content || content.trim() === '') {
            throw new Error('Content cannot be empty');
        }

        const sections = content.split(/\n\n+/)
            .filter(section => section.trim().length > 0)
            .map((section, index) => ({
                content: section,
                startIndex: content.indexOf(section),
                endIndex: content.indexOf(section) + section.length
            }));

        const batchSize = 5;
        const sectionEmbeddings: Section[] = [];
        
        for (let i = 0; i < sections.length; i += batchSize) {
            const batch = sections.slice(i, i + batchSize);
            const embeddings = await Promise.all(
                batch.map(section => generateDocumentEmbedding(section.content))
            );
            
            batch.forEach((section, index) => {
                sectionEmbeddings.push({
                    ...section,
                    embedding: embeddings[index]
                });
            });
        }

        const doc = await prisma.document.create({
            data: {
                content: encrypt(content),
                sections: encrypt(JSON.stringify(sectionEmbeddings)),
                metadata: metadata ? encrypt(metadata) : undefined,
                chat: {
                    connect: { id: chatId }
                }
            }
        });

        return {
            id: doc.id,
            content,
            metadata,
            sectionCount: sectionEmbeddings.length,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
        };
    } catch (error) {
        throw error;
    }
}

export async function updateDocument(id: string, content: string, chatId: string, metadata?: string) {
    try {
        if (!content || content.trim() === '') {
            throw new Error('Content cannot be empty');
        }

        const sections = content.split(/\n\n+/)
            .filter(section => section.trim().length > 0)
            .map((section, index) => ({
                content: section,
                startIndex: content.indexOf(section),
                endIndex: content.indexOf(section) + section.length
            }));

        const batchSize = 5;
        const sectionEmbeddings: Section[] = [];
        
        for (let i = 0; i < sections.length; i += batchSize) {
            const batch = sections.slice(i, i + batchSize);
            const embeddings = await Promise.all(
                batch.map(section => generateDocumentEmbedding(section.content))
            );
            
            batch.forEach((section, index) => {
                sectionEmbeddings.push({
                    ...section,
                    embedding: embeddings[index]
                });
            });
        }

        const doc = await prisma.document.update({
            where: { id },
            data: {
                content: encrypt(content),
                sections: encrypt(JSON.stringify(sectionEmbeddings)),
                metadata: metadata ? encrypt(metadata) : undefined,
                chat: {
                    connect: { id: chatId }
                }
            }
        });

        return {
            id: doc.id,
            content,
            metadata,
            sectionCount: sectionEmbeddings.length,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
        };
    } catch (error) {
        throw error;
    }
}

export async function deleteDocument(id: string) {
    try {
        const doc = await prisma.document.delete({ where: { id } });

        return {
            id: doc.id,
            content: decrypt(doc.content),
            sections: decrypt(doc.sections),
            metadata: doc.metadata ? decrypt(doc.metadata) : undefined,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
        };
    } catch (error) {
        throw error;
    }
}