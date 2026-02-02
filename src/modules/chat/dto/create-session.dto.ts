import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateSessionDto {
  @ApiPropertyOptional({
    description: 'Optional session name or description',
    example: 'Product Support Chat',
  })
  @IsOptional()
  @IsString()
  name?: string;
}
