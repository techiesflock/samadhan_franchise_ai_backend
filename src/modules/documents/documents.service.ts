import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { IngestionService } from '../ingestion/ingestion.service';
import { VectorService } from '../vector/vector.service';

export interface UploadedDocument {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  uploadedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly uploadDir: string;
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];
  private documents: Map<string, UploadedDocument> = new Map();

  constructor(
    private configService: ConfigService,
    private ingestionService: IngestionService,
    private vectorService: VectorService,
  ) {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.maxFileSize = this.configService.get<number>('upload.maxFileSize');
    this.allowedMimeTypes = this.configService.get<string[]>('upload.allowedMimeTypes');
    this.initializeUploadDir();
  }

  private async initializeUploadDir() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      this.logger.log(`Upload directory initialized: ${this.uploadDir}`);
      
      // Load existing documents from disk
      await this.loadDocumentsFromDisk();
    } catch (error) {
      this.logger.error('Failed to create upload directory', error.stack);
    }
  }

  /**
   * Load documents from uploads folder (recursively scans all subdirectories)
   */
  private async loadDocumentsFromDisk() {
    try {
      this.logger.log(`🔍 Scanning uploads folder recursively: ${this.uploadDir}`);
      const allFiles = await this.getAllFilesRecursively(this.uploadDir);
      
      let loadedCount = 0;
      
      for (const filePath of allFiles) {
        const fileName = path.basename(filePath);
        const relativePath = path.relative(this.uploadDir, filePath);
        
        // Check if already in memory
        const existingDoc = Array.from(this.documents.values()).find(
          doc => doc.path === filePath
        );
        
        if (!existingDoc) {
          const stats = await fs.stat(filePath);
          
          // Generate unique ID from relative path
          const uniqueId = relativePath.replace(/[\/\\]/g, '_').replace(/\.[^.]+$/, '');
          
          // Add to memory map
          const doc: UploadedDocument = {
            id: uniqueId,
            fileName: relativePath, // Store relative path for folder structure
            originalName: fileName,
            mimeType: this.getMimeType(fileName),
            size: stats.size,
            path: filePath,
            uploadedAt: stats.birthtime,
            status: 'completed',
          };
          
          this.documents.set(doc.id, doc);
          loadedCount++;
          this.logger.log(`📄 Loaded: ${relativePath}`);
        }
      }
      
      this.logger.log(`✅ Loaded ${loadedCount} new documents (total: ${this.documents.size})`);
    } catch (error) {
      this.logger.error('Failed to load documents from disk', error.stack);
    }
  }

  /**
   * Recursively get all files in a directory
   */
  private async getAllFilesRecursively(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        // Skip hidden files/folders
        if (entry.name.startsWith('.')) continue;
        
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively scan subdirectory
          const subFiles = await this.getAllFilesRecursively(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          // Check if it's a supported file type
          if (this.isSupportedFileType(entry.name)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error scanning directory ${dir}:`, error.message);
    }
    
    return files;
  }

  /**
   * Check if file type is supported
   */
  private isSupportedFileType(fileName: string): boolean {
    const ext = path.extname(fileName).toLowerCase();
    const supportedExtensions = ['.pdf', '.txt', '.doc', '.docx'];
    return supportedExtensions.includes(ext);
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Validate uploaded file
   */
  validateFile(file: Express.Multer.File): void {
    // Check file size
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`,
      );
    }

    // Check mime type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
      );
    }
  }

  /**
   * Upload and process a document
   */
  async uploadDocument(file: Express.Multer.File): Promise<UploadedDocument> {
    try {
      this.validateFile(file);

      const documentId = uuidv4();
      const fileExtension = path.extname(file.originalname);
      const fileName = `${documentId}${fileExtension}`;
      const filePath = path.join(this.uploadDir, fileName);

      // Save file
      await fs.writeFile(filePath, file.buffer);
      this.logger.log(`File saved: ${fileName}`);

      const document: UploadedDocument = {
        id: documentId,
        fileName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: filePath,
        uploadedAt: new Date(),
        status: 'processing',
      };

      this.documents.set(documentId, document);

      // Process document asynchronously
      this.processDocumentAsync(documentId, filePath, file.originalname, file.mimetype);

      return document;
    } catch (error) {
      this.logger.error('Failed to upload document', error.stack);
      throw error;
    }
  }

  /**
   * Process document asynchronously
   */
  private async processDocumentAsync(
    documentId: string,
    filePath: string,
    originalName: string,
    mimeType: string,
  ): Promise<void> {
    try {
      const result = await this.ingestionService.processDocument(
        filePath,
        originalName,
        mimeType,
        { uploadedDocumentId: documentId },
      );

      const document = this.documents.get(documentId);
      if (document) {
        document.status = result.status === 'success' ? 'completed' : 'failed';
        this.documents.set(documentId, document);
      }

      this.logger.log(`Document processing completed: ${documentId} - ${result.status}`);
    } catch (error) {
      this.logger.error(`Failed to process document: ${documentId}`, error.stack);
      const document = this.documents.get(documentId);
      if (document) {
        document.status = 'failed';
        this.documents.set(documentId, document);
      }
    }
  }

  /**
   * Upload multiple documents
   */
  async uploadMultipleDocuments(files: Express.Multer.File[]): Promise<UploadedDocument[]> {
    this.logger.log(`Uploading ${files.length} documents`);

    const results = await Promise.all(files.map((file) => this.uploadDocument(file)));

    return results;
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId: string): Promise<UploadedDocument | null> {
    return this.documents.get(documentId) || null;
  }

  /**
   * Get all documents
   */
  async getAllDocuments(): Promise<UploadedDocument[]> {
    // Reload from disk to ensure we have latest files
    await this.loadDocumentsFromDisk();
    return Array.from(this.documents.values());
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      const document = this.documents.get(documentId);
      if (!document) {
        throw new BadRequestException('Document not found');
      }

      // Delete from vector store
      await this.ingestionService.deleteDocument(documentId);

      // Delete file
      try {
        await fs.unlink(document.path);
      } catch (error) {
        this.logger.warn(`Failed to delete file: ${document.path}`);
      }

      // Remove from memory
      this.documents.delete(documentId);

      this.logger.log(`Document deleted: ${documentId}`);
    } catch (error) {
      this.logger.error(`Failed to delete document: ${documentId}`, error.stack);
      throw error;
    }
  }

  /**
   * Re-index all documents
   */
  async reindexAllDocuments(userId: string): Promise<any> {
    try {
      this.logger.log('🔄 Starting re-indexing of all documents...');
      
      const allDocuments = Array.from(this.documents.values());
      
      if (allDocuments.length === 0) {
        this.logger.warn('No documents to re-index');
        return {
          success: true,
          message: 'No documents to re-index',
          totalDocuments: 0,
          reindexed: 0,
          failed: 0,
        };
      }

      this.logger.log(`Found ${allDocuments.length} documents to re-index`);

      let reindexed = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const document of allDocuments) {
        try {
          this.logger.log(`Re-indexing: ${document.originalName} (${document.id})`);
          
          // Update status to processing
          document.status = 'processing';
          this.documents.set(document.id, document);

          // Delete existing embeddings for this document
          await this.ingestionService.deleteDocument(document.id);
          
          // Re-ingest the document
          await this.ingestionService.processDocument(
            document.path,
            document.originalName,
            document.id
          );

          // Update status to completed
          document.status = 'completed';
          this.documents.set(document.id, document);
          
          reindexed++;
          this.logger.log(`✅ Re-indexed: ${document.originalName}`);
        } catch (error) {
          this.logger.error(`❌ Failed to re-index ${document.originalName}: ${error.message}`);
          
          // Update status to failed
          document.status = 'failed';
          this.documents.set(document.id, document);
          
          failed++;
          errors.push(`${document.originalName}: ${error.message}`);
        }
      }

      const result = {
        success: true,
        message: `Re-indexing completed: ${reindexed} successful, ${failed} failed`,
        totalDocuments: allDocuments.length,
        reindexed,
        failed,
        errors: failed > 0 ? errors : undefined,
      };

      this.logger.log(`✅ Re-indexing completed: ${reindexed}/${allDocuments.length} successful`);
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to re-index documents: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Reload documents from disk (public method)
   */
  async reloadDocumentsFromDisk(): Promise<void> {
    this.logger.log('🔄 Reloading documents from disk...');
    await this.loadDocumentsFromDisk();
  }

  /**
   * Get vector store statistics
   */
  async getStats() {
    const vectorStats = await this.vectorService.getStats();
    return {
      totalDocuments: this.documents.size,
      totalChunks: vectorStats.count,
      collectionName: vectorStats.collectionName,
      documents: Array.from(this.documents.values()).map((doc) => ({
        id: doc.id,
        originalName: doc.originalName,
        status: doc.status,
        uploadedAt: doc.uploadedAt,
      })),
    };
  }
}
