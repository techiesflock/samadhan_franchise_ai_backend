import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, IsNumber, Min, Max } from 'class-validator';

export enum OpenAIModel {
  GPT_4O_MINI = 'gpt-4o-mini',
  GPT_4O = 'gpt-4o',
  GPT_4_TURBO = 'gpt-4-turbo',
  GPT_35_TURBO = 'gpt-3.5-turbo',
}

export class AskQuestionDto {
  @ApiProperty({
    description: 'The question or message to ask',
    example: 'What is the capital of France?',
  })
  @IsString()
  @IsNotEmpty({ message: 'Message cannot be empty' })
  message: string;

  @ApiProperty({
    description: 'Session ID to continue conversation (optional)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsString()
  @IsOptional()
  sessionId?: string;

  @ApiProperty({
    description: 'Whether to include conversation history in context',
    example: true,
    default: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  includeHistory?: boolean;

  @ApiProperty({
    description: 'Number of relevant documents to retrieve from knowledge base',
    example: 5,
    default: 5,
    minimum: 1,
    maximum: 20,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(20)
  topK?: number;

  @ApiProperty({
    description: 'OpenAI model to use for chat completion',
    enum: OpenAIModel,
    example: OpenAIModel.GPT_4O_MINI,
    default: OpenAIModel.GPT_4O_MINI,
    required: false,
  })
  @IsEnum(OpenAIModel, {
    message: 'Model must be one of: gpt-4o-mini, gpt-4o, gpt-4-turbo, gpt-3.5-turbo',
  })
  @IsOptional()
  model?: OpenAIModel;
}
