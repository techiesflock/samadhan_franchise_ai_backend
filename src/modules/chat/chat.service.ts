import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { GeminiService, ChatMessage } from './services/gemini.service';
import { QACacheService } from './services/qa-cache.service';
import { VectorService, SearchResult } from '../vector/vector.service';
import { FileProcessorService } from './services/file-processor.service';
import { ChatSessionEntity } from '../../entities/chat-session.entity';

export interface ChatSession {
  id: string;
  userId: string;
  history: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
  includeHistory?: boolean;
  topK?: number;
  model?: string;
  file?: Express.Multer.File;
}

export interface ChatResponse {
  sessionId: string;
  message: string;
  answer: string;
  sources: Array<{
    content: string;
    fileName: string;
    score: number;
    metadata: any;
  }>;
  responseSource: 'cached' | 'knowledge_base' | 'ai_generated' | 'hybrid';
  relevanceScore?: number;
  modelUsed: string;
  suggestedQuestions?: string[];
  timestamp: Date;
  fromCache?: boolean;
  cacheSimilarity?: number;
  fileProcessed?: {
    fileName: string;
    type: string;
    size: number;
    extractedLength?: number;
  };
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private defaultTopK: number;
  private relevanceThreshold: number;
  private enableSuggestions: boolean;

  constructor(
    @InjectRepository(ChatSessionEntity)
    private sessionRepository: Repository<ChatSessionEntity>,
    private configService: ConfigService,
    private geminiService: GeminiService,
    private qaCacheService: QACacheService,
    private vectorService: VectorService,
    private fileProcessorService: FileProcessorService,
  ) {
    this.defaultTopK = this.configService.get<number>('chat.topK');
    this.relevanceThreshold = this.configService.get<number>('chat.relevanceThreshold');
    this.enableSuggestions = this.configService.get<boolean>('chat.enableSuggestions');
  }

  /**
   * Process a chat request with RAG
   */
  async chat(userId: string, request: ChatRequest): Promise<ChatResponse> {
    try {
      const {
        message,
        sessionId,
        includeHistory = true,
        topK = this.defaultTopK,
        model
      } = request;

      // Determine which model to use
      const modelToUse = model || this.configService.get<string>('gemini.model');

      if (!message || message.trim().length === 0) {
        throw new BadRequestException('Message cannot be empty');
      }

      // Get or create session
      let session: ChatSession;
      if (sessionId) {
        session = await this.getSession(sessionId);
        if (!session) {
          throw new BadRequestException('Invalid session ID');
        }
        if (session.userId !== userId) {
          throw new BadRequestException('Session does not belong to user');
        }
      } else {
        session = await this.createSession(userId);
      }

      this.logger.log(`Processing chat request for session: ${session.id}`);

      // Step 0: Check cache first (skip if file upload)
      if (!request.file) {
        this.logger.log('🔍 Checking Q&A cache...');
        const cacheResult = await this.qaCacheService.searchCache(message, userId);
        
        if (cacheResult.found && cacheResult.response) {
          this.logger.log(`✅ Returning cached response (${(cacheResult.similarity! * 100).toFixed(1)}% match)`);
          
          // Update session history with cached response
          session.history.push(
            { role: 'user', content: message },
            { role: 'assistant', content: cacheResult.response.answer },
          );
          session.updatedAt = new Date();
          
          await this.sessionRepository.update(session.id, {
            messages: session.history as any,
            updatedAt: session.updatedAt,
          });
          
          return {
            sessionId: session.id,
            message,
            answer: cacheResult.response.answer,
            sources: cacheResult.response.documentSources 
              ? cacheResult.response.documentSources.map(doc => ({
                  content: '',
                  fileName: doc,
                  score: 1,
                  metadata: {},
                }))
              : [],
            responseSource: 'cached',
            fromCache: true,
            cacheSimilarity: cacheResult.similarity,
            modelUsed: 'cached',
            timestamp: new Date(),
            suggestedQuestions: [],
          };
        }
        
        this.logger.log('❌ No suitable cache found, proceeding with AI generation');
      }

      // Step 1: Process file if present
      let fileContext = '';
      let fileInfo: any = null;
      if (request.file) {
        this.logger.log(`📎 Processing uploaded file: ${request.file.originalname} (${request.file.mimetype}, ${(request.file.size / 1024).toFixed(1)} KB)`);
        
        const processedFile = await this.fileProcessorService.processFile(request.file);
        
        if (processedFile.error) {
          throw new BadRequestException(`File processing error: ${processedFile.error}`);
        }
        
        fileInfo = {
          fileName: processedFile.fileName,
          mimeType: processedFile.mimeType,
          size: processedFile.size,
        };
        
        // Handle image files with Gemini Vision
        if (processedFile.imageData) {
          this.logger.log('🖼️ Analyzing image with Gemini Vision...');
          const imagePrompt = message || 'Please analyze this image and describe what you see in detail. Include any text, objects, patterns, colors, and relevant information.';
          
          const imageAnalysis = await this.geminiService.analyzeImage(
            processedFile.imageData,
            processedFile.mimeType,
            imagePrompt,
            modelToUse
          );
          
          this.logger.log(`✅ Image analysis complete (${imageAnalysis.length} chars)`);
          
          // Update session history with image analysis
          session.history.push(
            { role: 'user', content: `[Image: ${processedFile.fileName}] ${message || 'Analyze this image'}` },
            { role: 'assistant', content: imageAnalysis },
          );
          session.updatedAt = new Date();
          
          // Save session
          await this.sessionRepository.update(session.id, {
            messages: session.history as any,
            updatedAt: session.updatedAt,
          });
          
          // Return image analysis response directly
          return {
            sessionId: session.id,
            message: message || 'Analyze this image',
            answer: imageAnalysis,
            sources: [],
            responseSource: 'ai_generated',
            modelUsed: modelToUse,
            timestamp: new Date(),
            fileProcessed: {
              fileName: processedFile.fileName,
              type: 'image',
              size: processedFile.size,
            },
            suggestedQuestions: [],
          };
        }
        
        // Handle document files with text extraction
        if (processedFile.content) {
          this.logger.log(`📄 Extracted ${processedFile.content.length} characters from document`);
          
          // Truncate very long documents to avoid token limits
          const maxContentLength = 15000; // ~4000 tokens
          const truncatedContent = processedFile.content.length > maxContentLength
            ? processedFile.content.substring(0, maxContentLength) + '\n\n[Content truncated...]'
            : processedFile.content;
          
          fileContext = `\n\n[User uploaded a file: ${processedFile.fileName}]\n\nFile content:\n${truncatedContent}\n\n---\n\nUser's question about the file:`;
          fileInfo.type = 'document';
          fileInfo.extractedLength = processedFile.content.length;
        }
      }

      // Enhance message with file context if present
      const enhancedMessage = fileContext ? fileContext + ' ' + message : message;

      // Step 1: Generate embedding for the user's question
      this.logger.log('Generating query embedding...');
      const queryEmbedding = await this.geminiService.generateEmbedding(enhancedMessage);

      // Step 2: Retrieve relevant documents from vector store
      this.logger.log(`Searching for top ${topK} relevant documents...`);
      const searchResults = await this.vectorService.search(queryEmbedding, topK);

      // Log search results for debugging
      if (searchResults.length > 0) {
        this.logger.log(`Found ${searchResults.length} results. Scores: ${searchResults.map(r => r.score.toFixed(4)).join(', ')}`);
        this.logger.log(`Relevance threshold: ${this.relevanceThreshold}`);
      } else {
        this.logger.log('No results found in knowledge base');
      }

      // Step 3: Determine if knowledge base has relevant information
      // Use knowledge base if we have results and they meet quality threshold
      // Note: Scores are similarity scores (0-1, where 1 is most similar)
      const hasRelevantData = searchResults.length > 0 &&
        searchResults.some(result => result.score >= this.relevanceThreshold);

      let answer: string;
      let responseSource: 'knowledge_base' | 'ai_generated' | 'hybrid';
      const maxScore = searchResults.length > 0 ? Math.max(...searchResults.map(r => r.score)) : 0;

      // Step 4: Get chat history if requested
      const history = includeHistory && session.history.length > 0 ? session.history : undefined;

      if (hasRelevantData) {
        // Use RAG: Build context from retrieved documents
        const context = this.buildContext(searchResults);
        this.logger.log(`✅ Using KNOWLEDGE BASE - Built context from ${searchResults.length} documents`);
        this.logger.log(`📊 Best match score: ${maxScore.toFixed(4)}`);

        // Generate response using context
        this.logger.log(`🤖 Generating response with Gemini using Knowledge Base context... (Model: ${modelToUse})`);
        answer = await this.geminiService.chat(message, context, history, undefined, modelToUse);
        responseSource = 'knowledge_base';
      } else {
        // No relevant data in knowledge base - use AI to generate response
        this.logger.log(`❌ No relevant data in knowledge base (max score: ${maxScore.toFixed(4)}, threshold: ${this.relevanceThreshold})`);
        this.logger.log(`🧠 Generating pure AI response (will be saved to knowledge base)... (Model: ${modelToUse})`);
        answer = await this.geminiService.chat(
          message,
          undefined, // No context
          history,
          undefined, // No options
          modelToUse // Model override
        );
        responseSource = 'ai_generated';

        // Step 5: Save AI-generated Q&A to knowledge base for future use
        try {
          await this.saveAIResponseToKnowledgeBase(message, answer, userId);
          this.logger.log('AI-generated response saved to knowledge base');
        } catch (error) {
          this.logger.error('Failed to save AI response to knowledge base', error.stack);
          // Don't fail the request if saving fails
        }
      }

      // Step 6: Update session history
      session.history.push(
        { role: 'user', content: message },
        { role: 'assistant', content: answer },
      );
      session.updatedAt = new Date();

      // Keep history manageable (last 10 messages = 5 exchanges)
      if (session.history.length > 10) {
        session.history = session.history.slice(-10);
      }

      // Save session to database
      await this.sessionRepository.update(session.id, {
        messages: session.history as any,
        updatedAt: session.updatedAt,
      });
      
      this.logger.log(`✅ Session saved to DB: ${session.id}`);

      // Step 6: Generate suggested follow-up questions (if enabled)
      let suggestedQuestions: string[] = [];
      if (this.enableSuggestions) {
        this.logger.log('💡 Generating suggested follow-up questions...');
        suggestedQuestions = await this.generateSuggestedQuestions(
          message,
          answer,
          searchResults,
          modelToUse,
        );
      }

      // Prepare response with sources
      const response: ChatResponse = {
        sessionId: session.id,
        message,
        answer,
        sources: searchResults.map((result) => ({
          content: this.truncateText(result.content, 200),
          fileName: result.metadata?.fileName || 'Unknown',
          score: result.score,
          metadata: {
            chunkIndex: result.metadata?.chunkIndex,
            source: result.metadata?.source,
          },
        })),
        responseSource,
        relevanceScore: maxScore,
        modelUsed: modelToUse,
        suggestedQuestions: suggestedQuestions.length > 0 ? suggestedQuestions : undefined,
        timestamp: new Date(),
        fromCache: false,
        ...(fileInfo && { fileProcessed: fileInfo }), // Include file info if document was processed
      };

      // Step 7: Save to cache for future use (skip if file upload)
      if (!request.file) {
        this.logger.log('💾 Saving response to cache...');
        const documentSources = searchResults
          .filter(r => r.metadata?.fileName)
          .map(r => r.metadata.fileName)
          .filter((v, i, a) => a.indexOf(v) === i); // unique values
        
        await this.qaCacheService.saveToCache(
          userId,
          message,
          answer,
          responseSource,
          modelToUse,
          documentSources.length > 0 ? documentSources : undefined,
        );
      }

      this.logger.log(`Chat request completed for session: ${session.id}`);
      return response;
    } catch (error) {
      this.logger.error('Failed to process chat request', error.stack);
      throw error;
    }
  }

  /**
   * Create a new chat session
   */
  async createSession(userId: string): Promise<ChatSession> {
    const sessionEntity = this.sessionRepository.create({
      userId,
      messages: [] as any,
    });

    await this.sessionRepository.save(sessionEntity);
    
    this.logger.log(`✅ Created new session in DB: ${sessionEntity.id}`);

    return {
      id: sessionEntity.id,
      userId: sessionEntity.userId,
      history: [],
      createdAt: sessionEntity.createdAt,
      updatedAt: sessionEntity.updatedAt,
    };
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<ChatSession | null> {
    const sessionEntity = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!sessionEntity) {
      return null;
    }

    const session = {
      id: sessionEntity.id,
      userId: sessionEntity.userId,
      history: sessionEntity.messages || [],
      messages: sessionEntity.messages || [], // ✅ Also include as 'messages' for frontend
      createdAt: sessionEntity.createdAt,
      updatedAt: sessionEntity.updatedAt,
    };

    return session as any;
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<ChatSession[]> {
    const sessionEntities = await this.sessionRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });

    return sessionEntities.map(entity => ({
      id: entity.id,
      userId: entity.userId,
      history: entity.messages || [],
      messages: entity.messages || [], // ✅ Also include as 'messages' for frontend
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    })) as any;
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session && session.userId === userId) {
      await this.sessionRepository.delete(sessionId);
      this.logger.log(`✅ Deleted session from DB: ${sessionId}`);
    }
  }

  /**
   * Clear session history
   */
  async clearSessionHistory(sessionId: string, userId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session && session.userId === userId) {
      await this.sessionRepository.update(sessionId, {
        messages: [] as any,
        updatedAt: new Date(),
      });
      this.logger.log(`✅ Cleared history for session: ${sessionId}`);
    }
  }

  /**
   * Save AI-generated Q&A to knowledge base for future retrieval
   */
  private async saveAIResponseToKnowledgeBase(
    question: string,
    answer: string,
    userId: string,
  ): Promise<void> {
    try {
      // Create a Q&A document
      const qaDocument = `Question: ${question}\n\nAnswer: ${answer}`;

      // Generate embedding for the Q&A
      const embedding = await this.geminiService.generateEmbedding(qaDocument);

      // Create document ID
      const documentId = `ai-qa-${uuidv4()}`;

      // Create document chunk
      const chunk = {
        id: documentId,
        content: qaDocument,
        metadata: {
          documentId,
          fileName: 'AI Generated Q&A',
          chunkIndex: 0,
          totalChunks: 1,
          source: 'ai_generated',
          type: 'qa_pair',
          question,
          answer,
          userId,
          createdAt: new Date().toISOString(),
        },
      };

      // Save to vector database
      await this.vectorService.addDocuments([chunk], [embedding]);

      this.logger.log(`Saved AI-generated Q&A to knowledge base: ${documentId}`);
    } catch (error) {
      this.logger.error('Failed to save AI response to knowledge base', error.stack);
      throw error;
    }
  }

  /**
   * Generate suggested follow-up questions based on the conversation
   */
  private async generateSuggestedQuestions(
    userQuestion: string,
    answer: string,
    sources: SearchResult[],
    modelToUse: string,
  ): Promise<string[]> {
    try {
      // Build context for question generation
      let prompt = `Based on the following conversation, generate 3 relevant follow-up questions that the user might want to ask next.\n\n`;
      prompt += `User's Question: ${userQuestion}\n\n`;
      prompt += `Assistant's Answer: ${answer}\n\n`;

      if (sources.length > 0) {
        prompt += `Available Topics (from knowledge base):\n`;
        sources.slice(0, 3).forEach((source, idx) => {
          prompt += `${idx + 1}. ${source.metadata?.fileName || 'Document'}\n`;
        });
        prompt += `\n`;
      }

      prompt += `Generate exactly 3 short, specific follow-up questions (one per line, no numbering or bullets). `;
      prompt += `Each question should be:\n`;
      prompt += `- Directly related to the topic discussed\n`;
      prompt += `- Natural and conversational\n`;
      prompt += `- Something a user would realistically ask next\n`;
      prompt += `- Between 5-15 words each\n\n`;
      prompt += `Output only the questions, one per line:`;

      let response: string;
      
      // Try flash-lite first, fallback to regular flash if it fails
      try {
        response = await this.geminiService.generateCompletion(
          prompt,
          { temperature: 0.7, maxTokens: 200 },
          'gemini-2.5-flash-lite'
        );
      } catch (liteError) {
        this.logger.warn('Flash-lite unavailable, using regular flash for suggestions');
        // Fallback to the model used for the main response
        response = await this.geminiService.generateCompletion(
          prompt,
          { temperature: 0.7, maxTokens: 200 },
          modelToUse
        );
      }

      // Parse questions from response
      const questions = response
        .split('\n')
        .map(q => q.trim())
        .filter(q => q.length > 0 && q.includes('?'))
        .map(q => q.replace(/^[0-9]+[\.\)]\s*/, '')) // Remove numbering if present
        .map(q => q.replace(/^[-•*]\s*/, '')) // Remove bullets if present
        .slice(0, 3); // Take only first 3

      this.logger.log(`✅ Generated ${questions.length} suggested questions`);
      return questions;
    } catch (error) {
      this.logger.warn(`⚠️  Could not generate suggested questions: ${error.message}`);
      // Return empty array on error - don't fail the main request
      return [];
    }
  }

  /**
   * Build context string from search results
   */
  private buildContext(results: SearchResult[]): string {
    if (results.length === 0) {
      return 'No relevant context found in the knowledge base.';
    }

    let context = 'Relevant information from the knowledge base:\n\n';

    results.forEach((result, index) => {
      context += `[Source ${index + 1} - ${result.metadata?.fileName || 'Unknown'}]\n`;
      context += `${result.content}\n\n`;
    });

    return context;
  }

  /**
   * Truncate text to specified length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Get service health status
   */
  async getHealth() {
    const vectorStats = await this.vectorService.getStats();
    const sessionCount = await this.sessionRepository.count();
    
    return {
      status: 'ok',
      geminiConfigured: this.geminiService.isConfigured(),
      activeSessions: sessionCount,
      vectorStore: {
        totalChunks: vectorStats.count,
        collectionName: vectorStats.collectionName,
      },
    };
  }
}
