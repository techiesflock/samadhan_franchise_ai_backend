import { IsString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFolderDto {
  @ApiProperty({ description: 'Folder name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Folder description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Parent folder ID (null for root level)' })
  @IsUUID()
  @IsOptional()
  parentId?: string;
}
