import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChromaClient, CloudClient, Collection } from 'chromadb';
import { v4 as uuidv4 } from 'uuid';

export interface DocumentChunk {
  id?: string;
  content: string;
  metadata: {
    documentId: string;
    fileName: string;
    chunkIndex: number;
    totalChunks: number;
    source?: string;
    [key: string]: any;
  };
}

export interface SearchResult {
  id: string;
  content: string;
  metadata: any;
  score: number;
}

@Injectable()
export class VectorService implements OnModuleInit {
  private readonly logger = new Logger(VectorService.name);
  private client: ChromaClient;
  private collection: Collection;
  private collectionName: string;

  constructor(private configService: ConfigService) {
    this.collectionName = this.configService.get<string>('vector.collectionName');
  }

  async onModuleInit() {
    await this.initializeChroma();
  }

  private async initializeChroma() {
    try {
      const chromaMode = this.configService.get<string>('vector.chromaMode');
      
      this.logger.log(`Initializing ChromaDB (mode: ${chromaMode})...`);

      // Initialize based on mode
      if (chromaMode === 'cloud') {
        await this.initializeCloudClient();
      } else {
        await this.initializeLocalClient();
      }

      // Get or create collection
      this.collection = await this.client.getOrCreateCollection({
        name: this.collectionName,
        metadata: { description: 'AI Assistant document embeddings' },
      });
      this.logger.log(`✅ Connected to collection: ${this.collectionName}`);

      const count = await this.collection.count();
      this.logger.log(`Collection contains ${count} documents`);
    } catch (error) {
      this.logger.error('❌ Failed to connect to ChromaDB', error.message);
      this.logger.warn('⚠️  Vector search will not be available.');
      if (this.configService.get<string>('vector.chromaMode') === 'local') {
        this.logger.warn('💡 To enable RAG functionality, run ChromaDB server:');
        this.logger.warn('   docker-compose up -d');
      }
      // Don't throw - allow app to start without ChromaDB
    }
  }

  private async initializeCloudClient() {
    const apiKey = this.configService.get<string>('vector.chromaCloud.apiKey');
    const tenant = this.configService.get<string>('vector.chromaCloud.tenant');
    const database = this.configService.get<string>('vector.chromaCloud.database');

    if (!apiKey || !tenant || !database) {
      throw new Error('ChromaDB Cloud credentials not configured in .env');
    }

    this.logger.log('☁️  Connecting to ChromaDB Cloud...');
    this.logger.log(`   Tenant: ${tenant}`);
    this.logger.log(`   Database: ${database}`);

    this.client = new CloudClient({
      apiKey,
      tenant,
      database,
    }) as any; // Type cast as CloudClient extends ChromaClient

    this.logger.log('✅ Connected to ChromaDB Cloud');
  }

  private async initializeLocalClient() {
    const chromaUrl = this.configService.get<string>('vector.chromaUrl');

    // Check if we should skip initialization
    if (!chromaUrl || chromaUrl === 'in-memory' || chromaUrl === 'disabled') {
      throw new Error('ChromaDB local server not configured');
    }

    this.logger.log(`🔗 Connecting to local ChromaDB server at: ${chromaUrl}`);
    
    this.client = new ChromaClient({
      path: chromaUrl,
    });

    this.logger.log('✅ Connected to local ChromaDB server');
  }

  /**
   * Add document chunks with embeddings to the vector store
   */
  async addDocuments(chunks: DocumentChunk[], embeddings: number[][]): Promise<void> {
    if (!this.collection) {
      throw new Error('ChromaDB is not initialized. Please start ChromaDB server.');
    }

    try {
      if (chunks.length !== embeddings.length) {
        throw new Error('Number of chunks must match number of embeddings');
      }

      const ids = chunks.map((chunk) => chunk.id || uuidv4());
      const documents = chunks.map((chunk) => chunk.content);
      const metadatas = chunks.map((chunk) => chunk.metadata);

      await this.collection.add({
        ids,
        embeddings,
        documents,
        metadatas,
      });

      this.logger.log(`Added ${chunks.length} document chunks to vector store`);
    } catch (error) {
      this.logger.error('Failed to add documents to vector store', error.stack);
      throw error;
    }
  }

  /**
   * Search for similar documents using query embedding
   */
  async search(queryEmbedding: number[], topK: number = 5): Promise<SearchResult[]> {
    if (!this.collection) {
      throw new Error('ChromaDB is not initialized. Please start ChromaDB server.');
    }

    try {
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK,
      });

      if (!results.ids || !results.ids[0] || results.ids[0].length === 0) {
        this.logger.log('No results found for query');
        return [];
      }

      const searchResults: SearchResult[] = [];

      for (let i = 0; i < results.ids[0].length; i++) {
        searchResults.push({
          id: results.ids[0][i],
          content: results.documents[0][i] as string,
          metadata: results.metadatas[0][i] as any,
          score: results.distances ? 1 - results.distances[0][i] : 0, // Convert distance to similarity score
        });
      }

      this.logger.log(`Found ${searchResults.length} similar documents`);
      return searchResults;
    } catch (error) {
      this.logger.error('Failed to search vector store', error.stack);
      throw error;
    }
  }

  /**
   * Delete documents by document ID
   */
  async deleteDocumentsByDocId(documentId: string): Promise<void> {
    try {
      // Get all documents with this documentId
      const results = await this.collection.get({
        where: { documentId },
      });

      if (results.ids && results.ids.length > 0) {
        await this.collection.delete({
          ids: results.ids,
        });
        this.logger.log(`Deleted ${results.ids.length} chunks for document ${documentId}`);
      }
    } catch (error) {
      this.logger.error('Failed to delete documents from vector store', error.stack);
      throw error;
    }
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<{ count: number; collectionName: string; available: boolean }> {
    if (!this.collection) {
      return {
        count: 0,
        collectionName: this.collectionName,
        available: false,
      };
    }

    try {
      const count = await this.collection.count();
      return {
        count,
        collectionName: this.collectionName,
        available: true,
      };
    } catch (error) {
      this.logger.error('Failed to get vector store stats', error.stack);
      return {
        count: 0,
        collectionName: this.collectionName,
        available: false,
      };
    }
  }

  /**
   * Clear all documents from collection (use with caution!)
   */
  async clearCollection(): Promise<void> {
    try {
      // Delete and recreate collection
      await this.client.deleteCollection({ name: this.collectionName });
      this.collection = await this.client.createCollection({
        name: this.collectionName,
        metadata: { description: 'AI Assistant document embeddings' },
      });
      this.logger.warn('Collection cleared - all documents deleted');
    } catch (error) {
      this.logger.error('Failed to clear collection', error.stack);
      throw error;
    }
  }
}
