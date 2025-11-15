/**
 * Semantic Memory Implementation using Vectorize
 * 
 * This module provides intelligent caching of Q&A pairs using vector embeddings.
 * When a similar question is asked, the cached answer is returned instead of
 * making redundant MCP calls.
 */

import type { Env, MemorySearchResult } from './types';

/**
 * Threshold for considering a cached result as a match
 * 0.85 = 85% similarity required
 */
const SIMILARITY_THRESHOLD = 0.85;

/**
 * Embedding model for text vectorization
 * Output: 768 dimensions
 */
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

/**
 * SemanticMemory class handles vector-based caching of Q&A pairs
 */
export class SemanticMemory {
  constructor(
    private vectorize: VectorizeIndex,
    private ai: Ai
  ) {}

  /**
   * Search for similar questions in memory
   * 
   * @param query - User's question
   * @param threshold - Similarity threshold (default: 0.85)
   * @returns MemorySearchResult if found, null otherwise
   */
  async search(
    query: string,
    threshold: number = SIMILARITY_THRESHOLD
  ): Promise<MemorySearchResult | null> {
    try {
      console.log(`[SemanticMemory] Searching for: "${query}"`);

      // Generate embedding for the query
      const embedding = await this.generateEmbedding(query);
      
      if (!embedding) {
        console.warn('[SemanticMemory] Failed to generate embedding');
        return null;
      }

      // Search Vectorize for similar vectors
      const results = await this.vectorize.query(embedding, {
        topK: 3,
        returnMetadata: true
      });

      console.log(`[SemanticMemory] Found ${results.matches.length} potential matches`);

      // Check if the top result meets the threshold
      if (results.matches.length > 0 && results.matches[0].score >= threshold) {
        const match = results.matches[0];
        console.log(`[SemanticMemory] Cache hit! Score: ${match.score}`);

        return {
          score: match.score,
          question: match.metadata?.question as string,
          answer: match.metadata?.answer as string,
          mcpSource: match.metadata?.mcpSource as string,
          timestamp: match.metadata?.timestamp as number
        };
      }

      console.log('[SemanticMemory] No match above threshold');
      return null;
    } catch (error) {
      console.error('[SemanticMemory] Search error:', error);
      return null;
    }
  }

  /**
   * Store a Q&A pair in semantic memory
   * 
   * @param question - User's question
   * @param answer - Agent's answer
   * @param mcpSource - Which MCP was used
   */
  async store(
    question: string,
    answer: string,
    mcpSource: string
  ): Promise<void> {
    try {
      console.log(`[SemanticMemory] Storing: "${question.substring(0, 50)}..."`);

      // Generate embedding for the question
      const embedding = await this.generateEmbedding(question);
      
      if (!embedding) {
        console.warn('[SemanticMemory] Failed to generate embedding for storage');
        return;
      }

      // Store in Vectorize with metadata
      await this.vectorize.insert([
        {
          id: this.generateId(question),
          values: embedding,
          metadata: {
            question,
            answer,
            mcpSource,
            timestamp: Date.now()
          }
        }
      ]);

      console.log('[SemanticMemory] Successfully stored in memory');
    } catch (error) {
      console.error('[SemanticMemory] Storage error:', error);
      // Don't throw - storage failure shouldn't break the main flow
    }
  }

  /**
   * Generate embedding vector for text
   * 
   * @param text - Input text
   * @returns Float32Array of 768 dimensions
   */
  private async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      // Truncate text if too long (model has token limits)
      const truncatedText = text.substring(0, 1000);

      const response = await this.ai.run(EMBEDDING_MODEL, {
        text: truncatedText
      });

      // Workers AI returns embeddings in the data array
      if (response && Array.isArray(response.data) && response.data.length > 0) {
        return response.data[0];
      }

      console.warn('[SemanticMemory] Unexpected embedding response format');
      return null;
    } catch (error) {
      console.error('[SemanticMemory] Embedding generation error:', error);
      return null;
    }
  }

  /**
   * Generate a deterministic ID from question text
   * Uses crypto.subtle for hashing
   * 
   * @param question - Question text
   * @returns UUID string
   */
  private generateId(question: string): string {
    // For simplicity, use a hash of the question + timestamp
    // In production, you might want a more sophisticated ID strategy
    const normalized = question.toLowerCase().trim().replace(/\s+/g, ' ');
    const timestamp = Date.now();
    return `${this.simpleHash(normalized)}-${timestamp}`;
  }

  /**
   * Simple hash function for ID generation
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get statistics about semantic memory usage
   */
  async getStats(): Promise<{
    totalEntries: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  }> {
    try {
      // Note: Vectorize doesn't have a direct count API
      // This is a placeholder for future implementation
      return {
        totalEntries: 0,
        oldestEntry: null,
        newestEntry: null
      };
    } catch (error) {
      console.error('[SemanticMemory] Stats error:', error);
      return {
        totalEntries: 0,
        oldestEntry: null,
        newestEntry: null
      };
    }
  }
}

