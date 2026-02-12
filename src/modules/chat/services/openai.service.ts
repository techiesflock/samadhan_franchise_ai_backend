import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

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
export class OpenAIService implements OnModuleInit {
  private readonly logger = new Logger(OpenAIService.name);
  private openai: OpenAI;
  private apiKey: string;
  private modelName: string;
  private embeddingModelName: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('openai.apiKey');
    this.modelName = this.configService.get<string>('openai.model');
    this.embeddingModelName = this.configService.get<string>('openai.embeddingModel');
  }

  onModuleInit() {
    this.initialize();
  }

  private initialize() {
    try {
      if (!this.apiKey) {
        throw new Error('OPENAI_API_KEY is not configured');
      }

      this.logger.log('Initializing OpenAI...');
      this.openai = new OpenAI({
        apiKey: this.apiKey,
      });

      this.logger.log(`OpenAI initialized with model: ${this.modelName}`);
      this.logger.log(`Embedding model: ${this.embeddingModelName}`);
    } catch (error) {
      this.logger.error('Failed to initialize OpenAI', error.stack);
      throw error;
    }
  }

  /**
   * Generate embeddings for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModelName,
        input: text,
      });
      return response.data[0].embedding;
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

      // OpenAI allows batch processing, but we'll process in smaller batches
      // to avoid hitting rate limits
      const batchSize = 20; // Process embeddings in batches of 20
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        
        const response = await this.openai.embeddings.create({
          model: this.embeddingModelName,
          input: batch,
        });

        const batchEmbeddings = response.data.map(item => item.embedding);
        embeddings.push(...batchEmbeddings);

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

      // Build messages array
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      // Add system message with context
      let systemMessage = 'You are a helpful AI assistant.';
      if (context) {
        systemMessage += `\n\nContext information:\n${context}`;
      }
      systemMessage += '\n\nPlease provide a helpful and accurate answer based on the context provided. If the context doesn\'t contain enough information to answer the question, please say so clearly.';

      messages.push({
        role: 'system',
        content: systemMessage,
      });

      // Add conversation history
      if (history && history.length > 0) {
        history.forEach((msg) => {
          messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content,
          });
        });
      }

      // Add current user message
      messages.push({
        role: 'user',
        content: message,
      });

      const modelToUse = modelOverride || this.modelName;
      this.logger.log(`Using model: ${modelToUse}`);

      const completion = await this.openai.chat.completions.create({
        model: modelToUse,
        messages,
        temperature,
        max_tokens: maxTokens,
      });

      const responseText = completion.choices[0].message.content || '';

      this.logger.log(`Generated chat response (${responseText.length} chars) using ${modelToUse}`);
      return responseText;
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

      const modelToUse = modelOverride || this.modelName;

      const completion = await this.openai.chat.completions.create({
        model: modelToUse,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature,
        max_tokens: maxTokens,
      });

      return completion.choices[0].message.content || '';
    } catch (error) {
      const errorMessage = error.message || error.toString();
      this.logger.error(`Failed to generate completion with ${modelOverride || this.modelName}: ${errorMessage}`);
      
      // Provide more context for common errors
      if (errorMessage.includes('API key')) {
        this.logger.error('Check your OPENAI_API_KEY in .env file');
      } else if (errorMessage.includes('model') || errorMessage.includes('not found')) {
        this.logger.error(`Model "${modelOverride || this.modelName}" may not be available. Try using "gpt-4o-mini" or "gpt-3.5-turbo"`);
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
    return !!this.apiKey && !!this.openai;
  }

  /**
   * Analyze image with OpenAI Vision (GPT-4 Vision)
   */
  async analyzeImage(
    imageBuffer: Buffer,
    mimeType: string,
    prompt: string,
    modelOverride?: string,
  ): Promise<string> {
    try {
      const modelToUse = modelOverride || 'gpt-4o-mini'; // Use vision model
      this.logger.log(`Analyzing image with model: ${modelToUse}`);

      // Convert buffer to base64
      const base64Image = imageBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      const completion = await this.openai.chat.completions.create({
        model: modelToUse,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: dataUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 1024,
      });

      const text = completion.choices[0].message.content || '';
      this.logger.log(`Image analyzed successfully (${text.length} chars)`);
      return text;
    } catch (error) {
      this.logger.error('Failed to analyze image', error.stack);
      throw error;
    }
  }
}
