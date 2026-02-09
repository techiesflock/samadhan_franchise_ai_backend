import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DocumentEntity } from '../../entities/document.entity';
import { FolderEntity } from '../../entities/folder.entity';
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
  folderId?: string;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly uploadDir: string;
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(
    @InjectRepository(DocumentEntity)
    private documentRepository: Repository<DocumentEntity>,
    @InjectRepository(FolderEntity)
    private folderRepository: Repository<FolderEntity>,
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
    } catch (error) {
      this.logger.error('Failed to create upload directory', error.stack);
    }
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
  async uploadDocument(
    file: Express.Multer.File,
    folderId?: string,
    userId?: string,
  ): Promise<DocumentEntity> {
    try {
      this.validateFile(file);

      // Validate folder exists if folderId is provided
      if (folderId && userId) {
        const folder = await this.folderRepository.findOne({
          where: { id: folderId, userId },
        });
        if (!folder) {
          throw new BadRequestException('Folder not found');
        }
      }

      const fileExtension = path.extname(file.originalname);
      const fileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

      // Create folder path if folderId is provided
      let targetDir = this.uploadDir;
      if (folderId) {
        targetDir = path.join(this.uploadDir, folderId);
        await fs.mkdir(targetDir, { recursive: true });
      }

      const filePath = path.join(targetDir, fileName);

      // Save file to disk
      await fs.writeFile(filePath, file.buffer);
      this.logger.log(`File saved: ${fileName} in folder: ${folderId || 'root'}`);

      // Create document entity
      const document = this.documentRepository.create({
        userId,
        folderId: folderId || null,
        fileName,
        originalName: file.originalname,
        filePath,
        fileSize: file.size,
        mimeType: file.mimetype,
        status: 'processing',
      });

      // Save to database
      const savedDocument = await this.documentRepository.save(document);

      // Update folder counts
      if (folderId) {
        await this.updateFolderCounts(folderId);
      }

      // Process document asynchronously
      this.processDocumentAsync(savedDocument.id, filePath, file.originalname, file.mimetype);

      return savedDocument;
    } catch (error) {
      this.logger.error('Failed to upload document', error.stack);
      throw error;
    }
  }

  /**
   * Update folder document count
   */
  private async updateFolderCounts(folderId: string): Promise<void> {
    try {
      const folder = await this.folderRepository.findOne({
        where: { id: folderId },
        relations: ['documents', 'children'],
      });

      if (folder) {
        folder.documentCount = folder.documents?.length || 0;
        folder.folderCount = folder.children?.length || 0;
        await this.folderRepository.save(folder);
        this.logger.log(`Updated folder counts: ${folder.name} (docs: ${folder.documentCount}, folders: ${folder.folderCount})`);
      }
    } catch (error) {
      this.logger.error('Failed to update folder counts', error.stack);
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

      // Update document status in database
      const document = await this.documentRepository.findOne({
        where: { id: documentId },
      });

      if (document) {
        document.status = result.status === 'success' ? 'completed' : 'failed';
        await this.documentRepository.save(document);
      }

      this.logger.log(`Document processing completed: ${documentId} - ${result.status}`);
    } catch (error) {
      this.logger.error(`Failed to process document: ${documentId}`, error.stack);

      // Update status to failed in database
      const document = await this.documentRepository.findOne({
        where: { id: documentId },
      });

      if (document) {
        document.status = 'failed';
        document.errorMessage = error.message;
        await this.documentRepository.save(document);
      }
    }
  }

  /**
   * Upload multiple documents
   */
  async uploadMultipleDocuments(
    files: Express.Multer.File[],
    folderId?: string,
    userId?: string,
  ): Promise<DocumentEntity[]> {
    this.logger.log(`Uploading ${files.length} documents to folder: ${folderId || 'root'}`);

    const results = await Promise.all(
      files.map((file) => this.uploadDocument(file, folderId, userId)),
    );

    return results;
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId: string): Promise<DocumentEntity | null> {
    return this.documentRepository.findOne({
      where: { id: documentId },
      relations: ['folder'],
    });
  }

  /**
   * Get all documents for a user
   */
  async getAllDocuments(userId?: string): Promise<DocumentEntity[]> {
    if (userId) {
      return this.documentRepository.find({
        where: { userId },
        relations: ['folder'],
        order: { uploadedAt: 'DESC' },
      });
    }

    return this.documentRepository.find({
      relations: ['folder'],
      order: { uploadedAt: 'DESC' },
    });
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string, userId?: string): Promise<void> {
    try {
      const where: any = { id: documentId };
      if (userId) {
        where.userId = userId;
      }

      const document = await this.documentRepository.findOne({ where });

      if (!document) {
        throw new BadRequestException('Document not found');
      }

      const folderId = document.folderId;

      // Delete from vector store
      await this.ingestionService.deleteDocument(documentId);

      // Delete file from disk
      try {
        await fs.unlink(document.filePath);
      } catch (error) {
        this.logger.warn(`Failed to delete file: ${document.filePath}`);
      }

      // Remove from database
      await this.documentRepository.remove(document);

      // Update folder counts
      if (folderId) {
        await this.updateFolderCounts(folderId);
      }

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

      const allDocuments = await this.documentRepository.find({
        where: { userId },
      });

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
          await this.documentRepository.save(document);

          // Delete existing embeddings for this document
          await this.ingestionService.deleteDocument(document.id);

          // Re-ingest the document
          await this.ingestionService.processDocument(
            document.filePath,
            document.originalName,
            document.mimeType,
            { uploadedDocumentId: document.id }
          );

          // Update status to completed
          document.status = 'completed';
          await this.documentRepository.save(document);

          reindexed++;
          this.logger.log(`✅ Re-indexed: ${document.originalName}`);
        } catch (error) {
          this.logger.error(`❌ Failed to re-index ${document.originalName}: ${error.message}`);

          // Update status to failed
          document.status = 'failed';
          document.errorMessage = error.message;
          await this.documentRepository.save(document);

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
   * Get vector store statistics
   */
  async getStats(userId?: string) {
    const vectorStats = await this.vectorService.getStats();

    const where: any = {};
    if (userId) {
      where.userId = userId;
    }

    const documents = await this.documentRepository.find({ where });

    return {
      totalDocuments: documents.length,
      totalChunks: vectorStats.count,
      collectionName: vectorStats.collectionName,
      documents: documents.map((doc) => ({
        id: doc.id,
        originalName: doc.originalName,
        status: doc.status,
        uploadedAt: doc.uploadedAt,
      })),
    };
  }
}
