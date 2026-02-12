import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { ChatMessage, ChatOptions } from './openai.service';

/**
 * Unified AI Service - OpenAI Integration
 * Simplified wrapper for OpenAI service
 */
@Injectable()
export class AIService implements OnModuleInit {
  private readonly logger = new Logger(AIService.name);

  constructor(private openaiService: OpenAIService) {}

  onModuleInit() {
    this.logger.log('AI Service initialized with OpenAI');
  }

  /**
   * Generate embeddings for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    return this.openaiService.generateEmbedding(text);
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return this.openaiService.generateEmbeddings(texts);
  }

  /**
   * Generate chat completion with context
   */
  async chat(
    message: string,
    context?: string,
    history?: ChatMessage[],
    options?: ChatOptions,
    modelOverride?: string,
  ): Promise<string> {
    return this.openaiService.chat(message, context, history, options, modelOverride);
  }

  /**
   * Generate a simple completion without context
   */
  async generateCompletion(
    prompt: string,
    options?: ChatOptions,
    modelOverride?: string,
  ): Promise<string> {
    return this.openaiService.generateCompletion(prompt, options, modelOverride);
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return this.openaiService.isConfigured();
  }

  /**
   * Analyze image with OpenAI Vision
   */
  async analyzeImage(
    imageBuffer: Buffer,
    mimeType: string,
    prompt: string,
    modelOverride?: string,
  ): Promise<string> {
    return this.openaiService.analyzeImage(imageBuffer, mimeType, prompt, modelOverride);
  }

  /**
   * Get current AI provider
   */
  getProvider(): string {
    return 'openai';
  }
}

// Re-export types for convenience
export { ChatMessage, ChatOptions };
