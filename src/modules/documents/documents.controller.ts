import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  HttpStatus,
  HttpCode,
  Logger,
  Body,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('documents')
@Controller('documents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);
  
  constructor(private readonly documentsService: DocumentsService) { }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a single document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        folderId: {
          type: 'string',
          description: 'Optional folder ID to upload document to',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body('folderId') folderId?: string,
    @CurrentUser('id') userId?: string,
  ) {
    const document = await this.documentsService.uploadDocument(file, folderId, userId);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Document uploaded successfully. Processing in background.',
      data: document,
    };
  }

  @Post('upload/multiple')
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiOperation({ summary: 'Upload multiple documents' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
        folderId: {
          type: 'string',
          description: 'Optional folder ID to upload documents to',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Documents uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid files' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadMultipleDocuments(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('folderId') folderId?: string,
    @CurrentUser('id') userId?: string,
  ) {
    const documents = await this.documentsService.uploadMultipleDocuments(files, folderId, userId);
    return {
      statusCode: HttpStatus.CREATED,
      message: `${documents.length} documents uploaded successfully. Processing in background.`,
      data: documents,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all documents' })
  @ApiResponse({ status: 200, description: 'Documents retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAllDocuments(@CurrentUser('id') userId: string) {
    const documents = await this.documentsService.getAllDocuments(userId);
    return {
      statusCode: HttpStatus.OK,
      data: documents,
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get document statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStats(@CurrentUser('id') userId: string) {
    const stats = await this.documentsService.getStats(userId);
    return {
      statusCode: HttpStatus.OK,
      data: stats,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document by ID' })
  @ApiResponse({ status: 200, description: 'Document retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getDocument(@Param('id') id: string) {
    const document = await this.documentsService.getDocument(id);
    return {
      statusCode: HttpStatus.OK,
      data: document,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete document by ID' })
  @ApiResponse({ status: 200, description: 'Document deleted successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteDocument(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.documentsService.deleteDocument(id, userId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Document deleted successfully',
    };
  }

  @Post('reindex')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-index all documents' })
  @ApiResponse({ status: 200, description: 'Re-indexing completed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async reindexAllDocuments(@CurrentUser('id') userId: string) {
    this.logger.log(`🔄 Re-indexing all documents requested by user: ${userId}`);
    
    const result = await this.documentsService.reindexAllDocuments(userId);
    
    return {
      statusCode: HttpStatus.OK,
      message: 'All documents re-indexed successfully',
      data: result,
    };
  }
}
