import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import pdfParse from 'pdf-parse';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { VectorService, DocumentChunk } from '../vector/vector.service';
import { GeminiService } from '../chat/services/gemini.service';

export interface ProcessedDocument {
  documentId: string;
  fileName: string;
  totalChunks: number;
  status: 'success' | 'failed';
  message?: string;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private textSplitter: RecursiveCharacterTextSplitter;
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(
    private configService: ConfigService,
    private vectorService: VectorService,
    private geminiService: GeminiService,
  ) {
    this.chunkSize = this.configService.get<number>('ingestion.chunkSize');
    this.chunkOverlap = this.configService.get<number>('ingestion.chunkOverlap');

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    });
  }

  /**
   * Process a document file (PDF or text)
   */
  async processDocument(
    filePath: string,
    fileName: string,
    mimeType: string,
    additionalMetadata?: Record<string, any>,
  ): Promise<ProcessedDocument> {
    const documentId = uuidv4();

    try {
      this.logger.log(`Processing document: ${fileName} (${mimeType})`);

      // Extract text from file
      let text: string;
      if (mimeType === 'application/pdf') {
        text = await this.extractTextFromPdf(filePath);
      } else {
        text = await this.extractTextFromFile(filePath);
      }

      if (!text || text.trim().length === 0) {
        throw new Error('No text content extracted from document');
      }

      this.logger.log(`Extracted ${text.length} characters from ${fileName}`);

      // Split text into chunks
      const chunks = await this.splitText(text);
      this.logger.log(`Split into ${chunks.length} chunks`);

      // Create document chunks with metadata
      const documentChunks: DocumentChunk[] = chunks.map((content, index) => ({
        id: uuidv4(),
        content,
        metadata: {
          documentId,
          fileName,
          chunkIndex: index,
          totalChunks: chunks.length,
          source: 'upload',
          uploadedAt: new Date().toISOString(),
          ...additionalMetadata,
        },
      }));

      // Generate embeddings for all chunks
      this.logger.log('Generating embeddings...');
      const embeddings = await this.geminiService.generateEmbeddings(
        documentChunks.map((chunk) => chunk.content),
      );

      // Store in vector database
      await this.vectorService.addDocuments(documentChunks, embeddings);

      this.logger.log(`Successfully processed document: ${fileName}`);

      return {
        documentId,
        fileName,
        totalChunks: chunks.length,
        status: 'success',
      };
    } catch (error) {
      this.logger.error(`Failed to process document: ${fileName}`, error.stack);
      return {
        documentId,
        fileName,
        totalChunks: 0,
        status: 'failed',
        message: error.message,
      };
    }
  }

  /**
   * Process text directly (without file)
   */
  async processText(
    text: string,
    sourceName: string,
    additionalMetadata?: Record<string, any>,
  ): Promise<ProcessedDocument> {
    const documentId = uuidv4();

    try {
      this.logger.log(`Processing text from source: ${sourceName}`);

      if (!text || text.trim().length === 0) {
        throw new Error('No text content provided');
      }

      // Split text into chunks
      const chunks = await this.splitText(text);
      this.logger.log(`Split into ${chunks.length} chunks`);

      // Create document chunks with metadata
      const documentChunks: DocumentChunk[] = chunks.map((content, index) => ({
        id: uuidv4(),
        content,
        metadata: {
          documentId,
          fileName: sourceName,
          chunkIndex: index,
          totalChunks: chunks.length,
          source: 'text',
          processedAt: new Date().toISOString(),
          ...additionalMetadata,
        },
      }));

      // Generate embeddings for all chunks
      this.logger.log('Generating embeddings...');
      const embeddings = await this.geminiService.generateEmbeddings(
        documentChunks.map((chunk) => chunk.content),
      );

      // Store in vector database
      await this.vectorService.addDocuments(documentChunks, embeddings);

      this.logger.log(`Successfully processed text from: ${sourceName}`);

      return {
        documentId,
        fileName: sourceName,
        totalChunks: chunks.length,
        status: 'success',
      };
    } catch (error) {
      this.logger.error(`Failed to process text from: ${sourceName}`, error.stack);
      return {
        documentId,
        fileName: sourceName,
        totalChunks: 0,
        status: 'failed',
        message: error.message,
      };
    }
  }

  /**
   * Process multiple documents in batch
   */
  async processBatch(
    files: Array<{ path: string; name: string; mimeType: string }>,
  ): Promise<ProcessedDocument[]> {
    this.logger.log(`Processing batch of ${files.length} documents`);

    const results = await Promise.all(
      files.map((file) => this.processDocument(file.path, file.name, file.mimeType)),
    );

    const successful = results.filter((r) => r.status === 'success').length;
    this.logger.log(`Batch processing complete: ${successful}/${files.length} successful`);

    return results;
  }

  /**
   * Extract text from PDF file
   */
  private async extractTextFromPdf(filePath: string): Promise<string> {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer);
      return pdfData.text;
    } catch (error) {
      this.logger.error('Failed to extract text from PDF', error.stack);
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract text from text file
   */
  private async extractTextFromFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      this.logger.error('Failed to read text file', error.stack);
      throw new Error(`File reading failed: ${error.message}`);
    }
  }

  /**
   * Split text into chunks using RecursiveCharacterTextSplitter
   */
  private async splitText(text: string): Promise<string[]> {
    try {
      const documents = await this.textSplitter.createDocuments([text]);
      return documents.map((doc) => doc.pageContent);
    } catch (error) {
      this.logger.error('Failed to split text', error.stack);
      throw new Error(`Text splitting failed: ${error.message}`);
    }
  }

  /**
   * Delete document from vector store
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      await this.vectorService.deleteDocumentsByDocId(documentId);
      this.logger.log(`Deleted document: ${documentId}`);
    } catch (error) {
      this.logger.error(`Failed to delete document: ${documentId}`, error.stack);
      throw error;
    }
  }
}
