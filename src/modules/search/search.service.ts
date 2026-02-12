import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { DocumentEntity } from '../../entities/document.entity';
import { FolderEntity } from '../../entities/folder.entity';
import { VectorService } from '../vector/vector.service';
import { AIService } from '../chat/services/ai.service';
import { SearchDocumentsDto } from '../folders/dto/search-documents.dto';

export interface SearchResult {
  folders: FolderEntity[];
  documents: DocumentEntity[];
  aiSuggestions?: string[];
  relevanceScore?: number;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectRepository(DocumentEntity)
    private documentRepository: Repository<DocumentEntity>,
    @InjectRepository(FolderEntity)
    private folderRepository: Repository<FolderEntity>,
    private vectorService: VectorService,
    private aiService: AIService,
  ) {}

  /**
   * AI-powered search across folders and documents
   */
  async searchDocuments(
    userId: string,
    searchDto: SearchDocumentsDto,
  ): Promise<SearchResult> {
    const { query, folderId, includeSubfolders = true, limit = 20 } = searchDto;

    this.logger.log(`Searching for: "${query}" by user: ${userId}`);

    const results: SearchResult = {
      folders: [],
      documents: [],
      aiSuggestions: [],
    };

    // 1. Search folders by name/description
    results.folders = await this.searchFolders(userId, query, folderId, includeSubfolders);

    // 2. Search documents using vector similarity (AI-powered)
    const vectorResults = await this.vectorSearchDocuments(
      userId,
      query,
      folderId,
      includeSubfolders,
      limit,
    );
    results.documents = vectorResults.documents;
    results.relevanceScore = vectorResults.relevanceScore;

    // 3. Generate AI suggestions based on query
    results.aiSuggestions = await this.generateSearchSuggestions(query, results);

    this.logger.log(
      `Search completed: ${results.folders.length} folders, ${results.documents.length} documents`,
    );

    return results;
  }

  /**
   * Search folders by name and description
   */
  private async searchFolders(
    userId: string,
    query: string,
    folderId?: string,
    includeSubfolders: boolean = true,
  ): Promise<FolderEntity[]> {
    const queryBuilder = this.folderRepository
      .createQueryBuilder('folder')
      .where('folder.userId = :userId', { userId })
      .andWhere(
        '(LOWER(folder.name) LIKE LOWER(:query) OR LOWER(folder.description) LIKE LOWER(:query))',
        { query: `%${query}%` },
      );

    // Filter by parent folder if specified
    if (folderId) {
      if (includeSubfolders) {
        // Get all descendant folder IDs recursively
        const descendantIds = await this.getDescendantFolderIds(folderId, userId);
        descendantIds.push(folderId); // Include the parent folder itself
        
        if (descendantIds.length > 0) {
          queryBuilder.andWhere('folder.id IN (:...descendantIds)', { descendantIds });
        }
      } else {
        queryBuilder.andWhere('folder.parentId = :folderId', { folderId });
      }
    }

    return queryBuilder
      .orderBy('folder.name', 'ASC')
      .take(20)
      .getMany();
  }

  /**
   * Vector-based semantic search for documents using AI
   */
  private async vectorSearchDocuments(
    userId: string,
    query: string,
    folderId?: string,
    includeSubfolders: boolean = true,
    limit: number = 20,
  ): Promise<{ documents: DocumentEntity[]; relevanceScore: number }> {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.aiService.generateEmbedding(query);
      
      // Perform vector search using ChromaDB
      const vectorResults = await this.vectorService.search(queryEmbedding, limit);

      if (!vectorResults || vectorResults.length === 0) {
        return { documents: [], relevanceScore: 0 };
      }

      // Extract document IDs from metadata
      const documentIds = vectorResults
        .map(result => result.metadata?.documentId)
        .filter(id => id);

      if (documentIds.length === 0) {
        return { documents: [], relevanceScore: 0 };
      }

      // Fetch documents from database
      const queryBuilder = this.documentRepository
        .createQueryBuilder('document')
        .where('document.userId = :userId', { userId })
        .andWhere('document.id IN (:...documentIds)', { documentIds })
        .leftJoinAndSelect('document.folder', 'folder');

      // Filter by folder if specified
      if (folderId) {
        if (includeSubfolders) {
          // Get all descendant folder IDs recursively
          const descendantIds = await this.getDescendantFolderIds(folderId, userId);
          const folderIds = [folderId, ...descendantIds];
          
          if (folderIds.length > 0) {
            queryBuilder.andWhere('document.folderId IN (:...folderIds)', { folderIds });
          }
        } else {
          queryBuilder.andWhere('document.folderId = :folderId', { folderId });
        }
      }

      const documents = await queryBuilder.getMany();

      // Calculate average relevance score
      const avgScore = vectorResults.reduce((sum, r) => sum + (r.score || 0), 0) / vectorResults.length;

      // Sort documents by vector search relevance
      const sortedDocuments = documents.sort((a, b) => {
        const scoreA = vectorResults.find(r => r.metadata?.documentId === a.id)?.score || 0;
        const scoreB = vectorResults.find(r => r.metadata?.documentId === b.id)?.score || 0;
        return scoreB - scoreA;
      });

      return { documents: sortedDocuments, relevanceScore: avgScore };
    } catch (error) {
      this.logger.error('Vector search failed', error.stack);
      
      // Fallback to simple text search
      return this.fallbackTextSearch(userId, query, folderId, includeSubfolders, limit);
    }
  }

  /**
   * Fallback text search when vector search fails
   */
  private async fallbackTextSearch(
    userId: string,
    query: string,
    folderId?: string,
    includeSubfolders: boolean = true,
    limit: number = 20,
  ): Promise<{ documents: DocumentEntity[]; relevanceScore: number }> {
    const queryBuilder = this.documentRepository
      .createQueryBuilder('document')
      .where('document.userId = :userId', { userId })
      .andWhere(
        '(LOWER(document.originalName) LIKE LOWER(:query) OR LOWER(document.fileName) LIKE LOWER(:query))',
        { query: `%${query}%` },
      )
      .leftJoinAndSelect('document.folder', 'folder');

    // Filter by folder if specified
    if (folderId) {
      if (includeSubfolders) {
        // Get all descendant folder IDs recursively
        const descendantIds = await this.getDescendantFolderIds(folderId, userId);
        const folderIds = [folderId, ...descendantIds];
        
        if (folderIds.length > 0) {
          queryBuilder.andWhere('document.folderId IN (:...folderIds)', { folderIds });
        }
      } else {
        queryBuilder.andWhere('document.folderId = :folderId', { folderId });
      }
    }

    const documents = await queryBuilder
      .orderBy('document.uploadedAt', 'DESC')
      .take(limit)
      .getMany();

    return { documents, relevanceScore: 0.5 };
  }

  /**
   * Generate AI-powered search suggestions
   */
  private async generateSearchSuggestions(
    query: string,
    results: SearchResult,
  ): Promise<string[]> {
    try {
      if (results.folders.length === 0 && results.documents.length === 0) {
        // No results found, suggest alternative searches
        const prompt = `User searched for: "${query}" but no results were found. 
Suggest 3 alternative search terms or categories they might want to try. 
Return only the suggestions as a JSON array of strings.`;

        const response = await this.aiService.generateCompletion(prompt);
        return this.parseSuggestions(response);
      }

      // Results found, suggest related searches
      const folderNames = results.folders.map(f => f.name).slice(0, 5);
      const prompt = `User searched for: "${query}" and found documents in categories: ${folderNames.join(', ')}.
Suggest 3 related search terms they might be interested in.
Return only the suggestions as a JSON array of strings.`;

      const response = await this.aiService.generateCompletion(prompt);
      return this.parseSuggestions(response);
    } catch (error) {
      this.logger.error('Failed to generate suggestions', error.stack);
      return [];
    }
  }

  /**
   * Get all descendant folder IDs recursively
   */
  private async getDescendantFolderIds(folderId: string, userId: string): Promise<string[]> {
    const descendantIds: string[] = [];
    
    const getChildren = async (parentId: string) => {
      const children = await this.folderRepository.find({
        where: { parentId, userId },
      });
      
      for (const child of children) {
        descendantIds.push(child.id);
        await getChildren(child.id); // Recursively get descendants
      }
    };
    
    await getChildren(folderId);
    return descendantIds;
  }

  /**
   * Parse AI suggestions from response
   */
  private parseSuggestions(response: string): string[] {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(response);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, 3);
      }
    } catch {
      // If not JSON, try to extract suggestions from text
      const lines = response.split('\n').filter(line => line.trim());
      return lines
        .map(line => line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim())
        .filter(line => line.length > 0)
        .slice(0, 3);
    }
    return [];
  }

  /**
   * Get document statistics by category/folder
   */
  async getDocumentStatsByCategory(userId: string): Promise<any> {
    const folders = await this.folderRepository.find({
      where: { userId },
      relations: ['documents'],
    });

    const stats = folders.map(folder => ({
      folderId: folder.id,
      folderName: folder.name,
      documentCount: folder.documents?.length || 0,
    }));

    // Add root level documents (no folder)
    const rootDocuments = await this.documentRepository.count({
      where: { userId, folderId: IsNull() },
    });

    if (rootDocuments > 0) {
      stats.unshift({
        folderId: null,
        folderName: 'Root',
        documentCount: rootDocuments,
      });
    }

    return stats.sort((a, b) => b.documentCount - a.documentCount);
  }
}
