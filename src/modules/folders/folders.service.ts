import { Injectable, Logger, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { FolderEntity } from '../../entities/folder.entity';
import { DocumentEntity } from '../../entities/document.entity';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { MoveItemsDto } from './dto/move-items.dto';
import { DocumentsService } from '../documents/documents.service';

@Injectable()
export class FoldersService {
  private readonly logger = new Logger(FoldersService.name);

  constructor(
    @InjectRepository(FolderEntity)
    private folderRepository: Repository<FolderEntity>,
    @InjectRepository(DocumentEntity)
    private documentRepository: Repository<DocumentEntity>,
    @Inject(forwardRef(() => DocumentsService))
    private documentsService: DocumentsService,
  ) {}

  /**
   * Create a new folder
   */
  async createFolder(userId: string, createFolderDto: CreateFolderDto): Promise<FolderEntity> {
    try {
      // If parent folder is specified, validate it exists and belongs to user
      if (createFolderDto.parentId) {
        const parentFolder = await this.folderRepository.findOne({
          where: { id: createFolderDto.parentId, userId },
        });
        
        if (!parentFolder) {
          throw new BadRequestException('Parent folder not found');
        }
      }

      const folder = this.folderRepository.create({
        ...createFolderDto,
        userId,
      });

      const savedFolder = await this.folderRepository.save(folder);
      
      // Update parent folder count
      if (createFolderDto.parentId) {
        await this.updateFolderCounts(createFolderDto.parentId);
      }

      this.logger.log(`Folder created: ${savedFolder.name} (${savedFolder.id})`);
      return savedFolder;
    } catch (error) {
      this.logger.error('Failed to create folder', error.stack);
      throw error;
    }
  }

  /**
   * Get folder by ID with children and documents
   */
  async getFolder(folderId: string, userId: string): Promise<FolderEntity> {
    const folder = await this.folderRepository.findOne({
      where: { id: folderId, userId },
      relations: ['children', 'documents', 'parent'],
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    // Update counts
    folder.documentCount = folder.documents?.length || 0;
    folder.folderCount = folder.children?.length || 0;

    return folder;
  }

  /**
   * Get all root folders for a user (folders without parent)
   */
  async getRootFolders(userId: string): Promise<FolderEntity[]> {
    return this.folderRepository.find({
      where: { userId, parentId: IsNull() },
      relations: ['children', 'documents'],
      order: { name: 'ASC' },
    });
  }

  /**
   * Get folder tree hierarchy (all folders organized hierarchically)
   */
  async getFolderTree(userId: string): Promise<FolderEntity[]> {
    // Get all root folders for the user and load their children recursively
    const rootFolders = await this.folderRepository.find({
      where: { userId, parentId: IsNull() },
      relations: ['children', 'children.children', 'children.children.children'],
      order: { name: 'ASC' },
    });
    
    return rootFolders;
  }

  /**
   * Get folder contents (subfolders and documents)
   */
  async getFolderContents(folderId: string | null, userId: string): Promise<{
    folders: FolderEntity[];
    documents: DocumentEntity[];
    breadcrumbs: Array<{ id: string; name: string }>;
  }> {
    let folders: FolderEntity[];
    let documents: DocumentEntity[];
    let breadcrumbs: Array<{ id: string; name: string }> = [];

    if (folderId) {
      // Get specific folder contents
      const folder = await this.getFolder(folderId, userId);
      folders = folder.children || [];
      documents = folder.documents || [];
      
      // Build breadcrumbs
      breadcrumbs = await this.buildBreadcrumbs(folderId, userId);
    } else {
      // Get root level contents
      folders = await this.getRootFolders(userId);
      documents = await this.documentRepository.find({
        where: { userId, folderId: IsNull() },
        order: { uploadedAt: 'DESC' },
      });
    }

    // Update folder counts
    for (const folder of folders) {
      await this.updateFolderCounts(folder.id);
    }

    return { folders, documents, breadcrumbs };
  }

  /**
   * Build breadcrumb trail for a folder
   */
  private async buildBreadcrumbs(
    folderId: string,
    userId: string,
  ): Promise<Array<{ id: string; name: string }>> {
    const breadcrumbs: Array<{ id: string; name: string }> = [];
    let currentFolderId: string | null = folderId;

    while (currentFolderId) {
      const folder = await this.folderRepository.findOne({
        where: { id: currentFolderId, userId },
        relations: ['parent'],
      });

      if (!folder) break;

      breadcrumbs.unshift({ id: folder.id, name: folder.name });
      currentFolderId = folder.parentId;
    }

    return breadcrumbs;
  }

  /**
   * Update folder
   */
  async updateFolder(
    folderId: string,
    userId: string,
    updateFolderDto: UpdateFolderDto,
  ): Promise<FolderEntity> {
    const folder = await this.folderRepository.findOne({
      where: { id: folderId, userId },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    // If moving to a new parent, validate it
    if (updateFolderDto.parentId !== undefined) {
      if (updateFolderDto.parentId === folderId) {
        throw new BadRequestException('Cannot move folder into itself');
      }

      if (updateFolderDto.parentId) {
        // Check if new parent exists
        const newParent = await this.folderRepository.findOne({
          where: { id: updateFolderDto.parentId, userId },
        });

        if (!newParent) {
          throw new BadRequestException('Parent folder not found');
        }

        // Check if moving to a descendant (prevent circular reference)
        const isDescendant = await this.isDescendantOf(
          updateFolderDto.parentId,
          folderId,
        );
        if (isDescendant) {
          throw new BadRequestException('Cannot move folder into its own descendant');
        }
      }

      // Update counts for old and new parents
      const oldParentId = folder.parentId;
      if (oldParentId) {
        await this.updateFolderCounts(oldParentId);
      }
      if (updateFolderDto.parentId) {
        await this.updateFolderCounts(updateFolderDto.parentId);
      }
    }

    Object.assign(folder, updateFolderDto);
    return this.folderRepository.save(folder);
  }

  /**
   * Delete folder (and optionally its contents recursively)
   */
  async deleteFolder(folderId: string, userId: string, force: boolean = false): Promise<void> {
    const folder = await this.folderRepository.findOne({
      where: { id: folderId, userId },
      relations: ['children', 'documents'],
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    // If force delete, recursively delete all contents
    if (force) {
      await this.deleteFolderRecursively(folderId, userId);
      this.logger.log(`Folder and all contents deleted recursively: ${folderId}`);
      return;
    }

    // Check if folder has contents
    if (folder.children?.length > 0 || folder.documents?.length > 0) {
      throw new BadRequestException(
        'Folder is not empty. Please delete or move all contents first, or use force=true to delete recursively.',
      );
    }

    const parentId = folder.parentId;
    await this.folderRepository.remove(folder);

    // Update parent folder count
    if (parentId) {
      await this.updateFolderCounts(parentId);
    }

    this.logger.log(`Folder deleted: ${folderId}`);
  }

  /**
   * Recursively delete folder and all its contents
   */
  private async deleteFolderRecursively(folderId: string, userId: string): Promise<void> {
    const folder = await this.folderRepository.findOne({
      where: { id: folderId, userId },
      relations: ['children', 'documents'],
    });

    if (!folder) {
      return;
    }

    this.logger.log(`Deleting folder recursively: ${folder.name} (${folderId})`);

    // 1. Delete all documents in this folder (using DocumentsService to also delete from vector store)
    if (folder.documents && folder.documents.length > 0) {
      for (const doc of folder.documents) {
        this.logger.log(`  Deleting document: ${doc.fileName}`);
        try {
          await this.documentsService.deleteDocument(doc.id, userId);
        } catch (error) {
          this.logger.error(`Failed to delete document ${doc.id}:`, error.message);
        }
      }
    }

    // 2. Recursively delete all child folders
    if (folder.children && folder.children.length > 0) {
      for (const child of folder.children) {
        await this.deleteFolderRecursively(child.id, userId);
      }
    }

    // 3. Delete the folder itself
    const parentId = folder.parentId;
    await this.folderRepository.remove(folder);
    
    // Update parent folder count
    if (parentId) {
      await this.updateFolderCounts(parentId);
    }

    this.logger.log(`  Deleted folder: ${folder.name}`);
  }

  /**
   * Move folders and documents to a target folder
   */
  async moveItems(
    userId: string,
    moveItemsDto: MoveItemsDto,
  ): Promise<{ success: boolean; movedFolders: number; movedDocuments: number }> {
    let movedFolders = 0;
    let movedDocuments = 0;

    // Validate target folder if specified
    if (moveItemsDto.targetFolderId) {
      const targetFolder = await this.folderRepository.findOne({
        where: { id: moveItemsDto.targetFolderId, userId },
      });

      if (!targetFolder) {
        throw new BadRequestException('Target folder not found');
      }
    }

    // Move folders
    if (moveItemsDto.folderIds && moveItemsDto.folderIds.length > 0) {
      for (const folderId of moveItemsDto.folderIds) {
        // Prevent moving folder into itself or its descendants
        if (moveItemsDto.targetFolderId === folderId) {
          continue;
        }

        if (moveItemsDto.targetFolderId) {
          const isDescendant = await this.isDescendantOf(
            moveItemsDto.targetFolderId,
            folderId,
          );
          if (isDescendant) {
            continue;
          }
        }

        await this.folderRepository.update(
          { id: folderId, userId },
          { parentId: moveItemsDto.targetFolderId || null },
        );
        movedFolders++;
      }
    }

    // Move documents
    if (moveItemsDto.documentIds && moveItemsDto.documentIds.length > 0) {
      const result = await this.documentRepository.update(
        { id: In(moveItemsDto.documentIds), userId },
        { folderId: moveItemsDto.targetFolderId || null },
      );
      movedDocuments = result.affected || 0;
    }

    // Update folder counts
    if (moveItemsDto.targetFolderId) {
      await this.updateFolderCounts(moveItemsDto.targetFolderId);
    }

    return { success: true, movedFolders, movedDocuments };
  }

  /**
   * Check if folder B is a descendant of folder A
   */
  private async isDescendantOf(
    descendantId: string,
    ancestorId: string,
  ): Promise<boolean> {
    // Recursively check if descendantId is in the tree under ancestorId
    const checkDescendant = async (folderId: string): Promise<boolean> => {
      if (folderId === descendantId) return true;
      
      const children = await this.folderRepository.find({
        where: { parentId: folderId },
      });
      
      for (const child of children) {
        if (await checkDescendant(child.id)) return true;
      }
      
      return false;
    };
    
    return checkDescendant(ancestorId);
  }

  /**
   * Update folder counts (documents and subfolders)
   */
  async updateFolderCounts(folderId: string): Promise<void> {
    const folder = await this.folderRepository.findOne({
      where: { id: folderId },
      relations: ['children', 'documents'],
    });

    if (folder) {
      folder.documentCount = folder.documents?.length || 0;
      folder.folderCount = folder.children?.length || 0;
      await this.folderRepository.save(folder);
    }
  }

  /**
   * Get folder path (full path from root to folder)
   */
  async getFolderPath(folderId: string, userId: string): Promise<string> {
    const breadcrumbs = await this.buildBreadcrumbs(folderId, userId);
    return '/' + breadcrumbs.map(b => b.name).join('/');
  }

  /**
   * Search folders by name
   */
  async searchFolders(userId: string, query: string): Promise<FolderEntity[]> {
    return this.folderRepository
      .createQueryBuilder('folder')
      .where('folder.userId = :userId', { userId })
      .andWhere('LOWER(folder.name) LIKE LOWER(:query)', { query: `%${query}%` })
      .orWhere('LOWER(folder.description) LIKE LOWER(:query)', { query: `%${query}%` })
      .orderBy('folder.name', 'ASC')
      .getMany();
  }
}
