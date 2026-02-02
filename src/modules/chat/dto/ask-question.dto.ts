import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsInt, Min, Max, MinLength, IsEnum } from 'class-validator';

export enum GeminiModel {
  FLASH = 'gemini-2.5-flash',
  PRO = 'gemini-2.5-pro',
  FLASH_LITE = 'gemini-2.5-flash-lite',
}

export class AskQuestionDto {
  @ApiProperty({
    description: 'The question to ask the AI assistant',
    example: 'What is the return policy for electronics?',
  })
  @IsString()
  @MinLength(1, { message: 'Message cannot be empty' })
  message: string;

  @ApiPropertyOptional({
    description: 'Session ID for continuing a conversation',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'Include conversation history in the context',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeHistory?: boolean;

  @ApiPropertyOptional({
    description: 'Number of relevant documents to retrieve',
    default: 5,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;

  @ApiPropertyOptional({
    description: 'AI model to use for this request',
    enum: GeminiModel,
    example: GeminiModel.FLASH,
    default: GeminiModel.FLASH,
  })
  @IsOptional()
  @IsEnum(GeminiModel, {
    message: 'Model must be one of: gemini-2.5-flash, gemini-2.5-pro, gemini-2.5-flash-lite',
  })
  model?: GeminiModel;
}
