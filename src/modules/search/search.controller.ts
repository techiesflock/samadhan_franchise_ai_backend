import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SearchService, SearchResult } from './search.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SearchDocumentsDto } from '../folders/dto/search-documents.dto';

@ApiTags('search')
@Controller('search')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  @ApiOperation({ summary: 'AI-powered search across folders and documents' })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async searchDocuments(
    @CurrentUser('id') userId: string,
    @Body() searchDto: SearchDocumentsDto,
  ) {
    const results = await this.searchService.searchDocuments(userId, searchDto);
    return {
      statusCode: HttpStatus.OK,
      data: results,
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get document statistics by category/folder' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStatsByCategory(@CurrentUser('id') userId: string) {
    const stats = await this.searchService.getDocumentStatsByCategory(userId);
    return {
      statusCode: HttpStatus.OK,
      data: stats,
    };
  }
}
