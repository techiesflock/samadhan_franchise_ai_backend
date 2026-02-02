import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  topK?: number;
  topP?: number;
}

@Injectable()
export class GeminiService implements OnModuleInit {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private embeddingModel: GenerativeModel;
  private apiKey: string;
  private modelName: string;
  private embeddingModelName: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('gemini.apiKey');
    this.modelName = this.configService.get<string>('gemini.model');
    this.embeddingModelName = this.configService.get<string>('gemini.embeddingModel');
  }

  onModuleInit() {
    this.initialize();
  }

  private initialize() {
    try {
      if (!this.apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
      }

      this.logger.log('Initializing Google Gemini AI...');
      // Initialize with v1 API (not v1beta)
      this.genAI = new GoogleGenerativeAI(this.apiKey);

      // Initialize generative model with v1 API
      this.model = this.genAI.getGenerativeModel({
        model: this.modelName,
      }, {
        apiVersion: 'v1',
      });

      // Initialize embedding model with v1 API
      this.embeddingModel = this.genAI.getGenerativeModel({
        model: this.embeddingModelName,
      }, {
        apiVersion: 'v1',
      }) as any;

      this.logger.log(`Gemini initialized with model: ${this.modelName} (API v1)`);
      this.logger.log(`Embedding model: ${this.embeddingModelName}`);
    } catch (error) {
      this.logger.error('Failed to initialize Gemini', error.stack);
      throw error;
    }
  }

  /**
   * Generate embeddings for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const result = await this.embeddingModel.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      this.logger.error('Failed to generate embedding', error.stack);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      this.logger.log(`Generating embeddings for ${texts.length} texts...`);

      const embeddings: number[][] = [];

      // Process in batches to avoid rate limits
      const batchSize = 5;
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchPromises = batch.map((text) => this.generateEmbedding(text));
        const batchResults = await Promise.all(batchPromises);
        embeddings.push(...batchResults);

        // Small delay to avoid rate limiting
        if (i + batchSize < texts.length) {
          await this.delay(100);
        }
      }

      this.logger.log(`Generated ${embeddings.length} embeddings`);
      return embeddings;
    } catch (error) {
      this.logger.error('Failed to generate embeddings', error.stack);
      throw error;
    }
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
    try {
      const temperature = options?.temperature ?? this.configService.get<number>('chat.temperature');
      const maxTokens = options?.maxTokens ?? this.configService.get<number>('chat.maxTokens');

      // Build prompt with context
      let prompt = '';

      if (context) {
        prompt += `Context information:\n${context}\n\n`;
      }

      if (history && history.length > 0) {
        prompt += 'Previous conversation:\n';
        history.forEach((msg) => {
          prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
        });
        prompt += '\n';
      }

      prompt += `User question: ${message}\n\n`;
      prompt += `Please provide a helpful and accurate answer based on the context provided. If the context doesn't contain enough information to answer the question, please say so clearly.`;

      // Use model override if provided, otherwise use default model
      const modelToUse = modelOverride
        ? this.genAI.getGenerativeModel({ model: modelOverride }, { apiVersion: 'v1' })
        : this.model;

      this.logger.log(`Using model: ${modelOverride || this.modelName}`);

      const result = await modelToUse.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      });

      const response = result.response;
      const text = response.text();

      this.logger.log(`Generated chat response (${text.length} chars) using ${modelOverride || this.modelName}`);
      return text;
    } catch (error) {
      this.logger.error('Failed to generate chat response', error.stack);
      throw error;
    }
  }

  /**
   * Generate a simple completion without context
   */
  async generateCompletion(
    prompt: string,
    options?: ChatOptions,
    modelOverride?: string,
  ): Promise<string> {
    try {
      const temperature = options?.temperature ?? 0.7;
      const maxTokens = options?.maxTokens ?? 1024;

      // Use model override if provided, otherwise use default model
      const modelToUse = modelOverride
        ? this.genAI.getGenerativeModel({ model: modelOverride }, { apiVersion: 'v1' })
        : this.model;

      const result = await modelToUse.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      });

      return result.response.text();
    } catch (error) {
      const errorMessage = error.message || error.toString();
      this.logger.error(`Failed to generate completion with ${modelOverride || this.modelName}: ${errorMessage}`);
      
      // Provide more context for common errors
      if (errorMessage.includes('API key')) {
        this.logger.error('Check your GEMINI_API_KEY in .env file');
      } else if (errorMessage.includes('model') || errorMessage.includes('not found')) {
        this.logger.error(`Model "${modelOverride || this.modelName}" may not be available. Try using "gemini-2.5-flash" or "gemini-1.5-flash"`);
      }
      
      throw error;
    }
  }

  /**
   * Utility function to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey && !!this.genAI;
  }

  /**
   * Analyze image with Gemini Vision
   */
  async analyzeImage(
    imageBuffer: Buffer,
    mimeType: string,
    prompt: string,
    modelOverride?: string,
  ): Promise<string> {
    try {
      const modelToUse = modelOverride || this.modelName;
      this.logger.log(`Analyzing image with model: ${modelToUse}`);

      const model = this.genAI.getGenerativeModel({
        model: modelToUse,
      }, {
        apiVersion: 'v1',
      });

      // Convert buffer to base64
      const base64Image = imageBuffer.toString('base64');

      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      };

      const result = await model.generateContent([prompt, imagePart]);
      const response = result.response;
      const text = response.text();

      this.logger.log(`Image analyzed successfully (${text.length} chars)`);
      return text;
    } catch (error) {
      this.logger.error('Failed to analyze image', error.stack);
      throw error;
    }
  }
}
