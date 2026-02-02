import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QACache } from '../entities/qa-cache.entity';
import { GeminiService } from './gemini.service';

export interface CachedResponse {
  id: string;
  question: string;
  answer: string;
  source: string;
  similarity?: number;
  usageCount: number;
  lastUsedAt: Date;
  documentSources?: string[];
}

export interface CacheSearchResult {
  found: boolean;
  response?: CachedResponse;
  similarity?: number;
}

@Injectable()
export class QACacheService {
  private readonly logger = new Logger(QACacheService.name);
  private readonly SIMILARITY_THRESHOLD = 0.85; // 85% similarity to use cache

  constructor(
    @InjectRepository(QACache)
    private qaCacheRepository: Repository<QACache>,
    private geminiService: GeminiService,
  ) {}

  /**
   * Search for similar question in cache
   */
  async searchCache(
    question: string,
    userId: string,
  ): Promise<CacheSearchResult> {
    try {
      this.logger.log(`🔍 Searching cache for: "${question.substring(0, 50)}..."`);

      // Get question embedding
      const questionEmbedding = await this.geminiService.generateEmbedding(question);

      // Get all cached Q&A for this user (could optimize with pagination)
      const cachedItems = await this.qaCacheRepository.find({
        where: { userId },
        order: { lastUsedAt: 'DESC' },
        take: 100, // Limit for performance
      });

      if (cachedItems.length === 0) {
        this.logger.log('❌ Cache empty');
        return { found: false };
      }

      // Find most similar question
      let bestMatch: QACache | null = null;
      let highestSimilarity = 0;

      for (const item of cachedItems) {
        if (!item.embedding) continue;

        const cachedEmbedding = JSON.parse(item.embedding);
        const similarity = this.cosineSimilarity(questionEmbedding, cachedEmbedding);

        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
          bestMatch = item;
        }
      }

      // Check if similarity is above threshold
      if (bestMatch && highestSimilarity >= this.SIMILARITY_THRESHOLD) {
        this.logger.log(
          `✅ Cache HIT! Similarity: ${(highestSimilarity * 100).toFixed(2)}% - "${bestMatch.question.substring(0, 50)}..."`,
        );

        // Update usage stats
        await this.updateUsageStats(bestMatch.id);

        return {
          found: true,
          similarity: highestSimilarity,
          response: {
            id: bestMatch.id,
            question: bestMatch.question,
            answer: bestMatch.answer,
            source: 'cached',
            similarity: highestSimilarity,
            usageCount: bestMatch.usageCount + 1,
            lastUsedAt: new Date(),
            documentSources: bestMatch.documentSources,
          },
        };
      }

      this.logger.log(
        `❌ Cache MISS - Best similarity: ${(highestSimilarity * 100).toFixed(2)}%`,
      );
      return { found: false };
    } catch (error) {
      this.logger.error('Error searching cache:', error.stack);
      return { found: false };
    }
  }

  /**
   * Save new Q&A to cache
   */
  async saveToCache(
    userId: string,
    question: string,
    answer: string,
    source: string,
    model: string,
    documentSources?: string[],
  ): Promise<void> {
    try {
      this.logger.log(`💾 Saving to cache: "${question.substring(0, 50)}..."`);

      // Generate embedding for question
      const embedding = await this.geminiService.generateEmbedding(question);

      const cacheEntry = this.qaCacheRepository.create({
        userId,
        question,
        answer,
        source,
        model,
        documentSources,
        embedding: JSON.stringify(embedding),
        usageCount: 1,
        lastUsedAt: new Date(),
      });

      await this.qaCacheRepository.save(cacheEntry);
      this.logger.log('✅ Saved to cache successfully');
    } catch (error) {
      this.logger.error(`❌ Error saving to cache: ${error.message}`);
      if (error.stack) {
        this.logger.error(error.stack);
      }
      // Don't throw - cache failure shouldn't break the chat flow
    }
  }

  /**
   * Update usage statistics
   */
  private async updateUsageStats(cacheId: string): Promise<void> {
    try {
      await this.qaCacheRepository.update(cacheId, {
        usageCount: () => 'usage_count + 1',
        lastUsedAt: new Date(),
      });
    } catch (error) {
      this.logger.error('Error updating usage stats:', error.stack);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(userId: string): Promise<any> {
    const totalCached = await this.qaCacheRepository.count({ where: { userId } });
    const totalUsage = await this.qaCacheRepository
      .createQueryBuilder('cache')
      .select('SUM(cache.usageCount)', 'total')
      .where('cache.userId = :userId', { userId })
      .getRawOne();

    const mostUsed = await this.qaCacheRepository.find({
      where: { userId },
      order: { usageCount: 'DESC' },
      take: 5,
    });

    return {
      totalCached,
      totalUsage: totalUsage?.total || 0,
      mostUsed: mostUsed.map((item) => ({
        question: item.question,
        usageCount: item.usageCount,
      })),
    };
  }

  /**
   * Clear old cache entries
   */
  async clearOldCache(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.qaCacheRepository
      .createQueryBuilder()
      .delete()
      .where('lastUsedAt < :cutoffDate', { cutoffDate })
      .execute();

    this.logger.log(`🗑️ Cleared ${result.affected} old cache entries`);
    return result.affected || 0;
  }
}
