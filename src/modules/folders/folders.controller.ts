import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FoldersService } from './folders.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { MoveItemsDto } from './dto/move-items.dto';

@ApiTags('folders')
@Controller('folders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new folder' })
  @ApiResponse({ status: 201, description: 'Folder created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createFolder(
    @CurrentUser('id') userId: string,
    @Body() createFolderDto: CreateFolderDto,
  ) {
    const folder = await this.foldersService.createFolder(userId, createFolderDto);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Folder created successfully',
      data: folder,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get root folders or folder tree' })
  @ApiResponse({ status: 200, description: 'Folders retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getRootFolders(
    @CurrentUser('id') userId: string,
    @Query('tree') tree?: string,
  ) {
    const folders = tree
      ? await this.foldersService.getFolderTree(userId)
      : await this.foldersService.getRootFolders(userId);

    return {
      statusCode: HttpStatus.OK,
      data: folders,
    };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search folders by name or description' })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async searchFolders(
    @CurrentUser('id') userId: string,
    @Query('q') query: string,
  ) {
    const folders = await this.foldersService.searchFolders(userId, query);
    return {
      statusCode: HttpStatus.OK,
      data: folders,
    };
  }

  @Get('contents')
  @ApiOperation({ summary: 'Get folder contents (folders and documents)' })
  @ApiResponse({ status: 200, description: 'Contents retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFolderContents(
    @CurrentUser('id') userId: string,
    @Query('folderId') folderId?: string,
  ) {
    const contents = await this.foldersService.getFolderContents(
      folderId || null,
      userId,
    );
    return {
      statusCode: HttpStatus.OK,
      data: contents,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get folder by ID' })
  @ApiResponse({ status: 200, description: 'Folder retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFolder(
    @Param('id') folderId: string,
    @CurrentUser('id') userId: string,
  ) {
    const folder = await this.foldersService.getFolder(folderId, userId);
    return {
      statusCode: HttpStatus.OK,
      data: folder,
    };
  }

  @Get(':id/path')
  @ApiOperation({ summary: 'Get full folder path' })
  @ApiResponse({ status: 200, description: 'Path retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFolderPath(
    @Param('id') folderId: string,
    @CurrentUser('id') userId: string,
  ) {
    const path = await this.foldersService.getFolderPath(folderId, userId);
    return {
      statusCode: HttpStatus.OK,
      data: { path },
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update folder' })
  @ApiResponse({ status: 200, description: 'Folder updated successfully' })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateFolder(
    @Param('id') folderId: string,
    @CurrentUser('id') userId: string,
    @Body() updateFolderDto: UpdateFolderDto,
  ) {
    const folder = await this.foldersService.updateFolder(
      folderId,
      userId,
      updateFolderDto,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Folder updated successfully',
      data: folder,
    };
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Delete folder',
    description: 'Delete a folder. Use ?force=true to recursively delete all contents (folders and documents)'
  })
  @ApiResponse({ status: 200, description: 'Folder deleted successfully' })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  @ApiResponse({ status: 400, description: 'Folder is not empty (use force=true to delete recursively)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteFolder(
    @Param('id') folderId: string,
    @CurrentUser('id') userId: string,
    @Query('force') force?: string,
  ) {
    const forceDelete = force === 'true';
    await this.foldersService.deleteFolder(folderId, userId, forceDelete);
    return {
      statusCode: HttpStatus.OK,
      message: forceDelete 
        ? 'Folder and all contents deleted successfully' 
        : 'Folder deleted successfully',
    };
  }

  @Post('move')
  @ApiOperation({ summary: 'Move folders and/or documents to a target folder' })
  @ApiResponse({ status: 200, description: 'Items moved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async moveItems(
    @CurrentUser('id') userId: string,
    @Body() moveItemsDto: MoveItemsDto,
  ) {
    const result = await this.foldersService.moveItems(userId, moveItemsDto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Items moved successfully',
      data: result,
    };
  }
}
