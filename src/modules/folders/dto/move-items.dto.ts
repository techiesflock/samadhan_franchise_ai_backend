import { IsArray, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MoveItemsDto {
  @ApiPropertyOptional({ description: 'Array of folder IDs to move' })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  folderIds?: string[];

  @ApiPropertyOptional({ description: 'Array of document IDs to move' })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  documentIds?: string[];

  @ApiProperty({ description: 'Target folder ID (null for root level)' })
  @IsUUID()
  @IsOptional()
  targetFolderId?: string;
}
