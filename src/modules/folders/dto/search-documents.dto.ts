import { IsString, IsOptional, IsUUID, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SearchDocumentsDto {
  @ApiProperty({ description: 'Search query (keywords, categories, or content)' })
  @IsString()
  query: string;

  @ApiPropertyOptional({ description: 'Filter by folder ID' })
  @IsUUID()
  @IsOptional()
  folderId?: string;

  @ApiPropertyOptional({ description: 'Include subfolders in search', default: true })
  @IsOptional()
  includeSubfolders?: boolean;

  @ApiPropertyOptional({ description: 'Maximum number of results', default: 20 })
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  limit?: number;
}
