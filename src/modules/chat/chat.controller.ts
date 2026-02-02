import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { QACacheService } from './services/qa-cache.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AskQuestionDto } from './dto/ask-question.dto';
import { CreateSessionDto } from './dto/create-session.dto';

@ApiTags('chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly qaCacheService: QACacheService,
  ) { }

  @Post('ask')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Ask a question to the AI assistant (with optional file upload)' })
  @ApiResponse({ status: 200, description: 'Answer generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async askQuestion(
    @CurrentUser('id') userId: string,
    @Body() dto: AskQuestionDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const response = await this.chatService.chat(userId, {
      message: dto.message,
      sessionId: dto.sessionId,
      includeHistory: dto.includeHistory,
      topK: dto.topK,
      model: dto.model,
      file: file,
    });

    return {
      statusCode: HttpStatus.OK,
      data: response,
    };
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Create a new chat session' })
  @ApiResponse({ status: 201, description: 'Session created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createSession(@CurrentUser('id') userId: string) {
    const session = await this.chatService.createSession(userId);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Session created successfully',
      data: session,
    };
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Get all chat sessions for the current user' })
  @ApiResponse({ status: 200, description: 'Sessions retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserSessions(@CurrentUser('id') userId: string) {
    const sessions = await this.chatService.getUserSessions(userId);
    return {
      statusCode: HttpStatus.OK,
      data: sessions,
    };
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get a specific chat session' })
  @ApiResponse({ status: 200, description: 'Session retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSession(@CurrentUser('id') userId: string, @Param('id') sessionId: string) {
    const session = await this.chatService.getSession(sessionId);
    return {
      statusCode: HttpStatus.OK,
      data: session,
    };
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a chat session' })
  @ApiResponse({ status: 200, description: 'Session deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteSession(@CurrentUser('id') userId: string, @Param('id') sessionId: string) {
    await this.chatService.deleteSession(sessionId, userId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Session deleted successfully',
    };
  }

  @Post('sessions/:id/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear chat history for a session' })
  @ApiResponse({ status: 200, description: 'History cleared successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async clearHistory(@CurrentUser('id') userId: string, @Param('id') sessionId: string) {
    await this.chatService.clearSessionHistory(sessionId, userId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Chat history cleared successfully',
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Get chat service health status' })
  @ApiResponse({ status: 200, description: 'Health status retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getHealth() {
    const health = await this.chatService.getHealth();
    return {
      statusCode: HttpStatus.OK,
      data: health,
    };
  }

  @Get('cache/stats')
  @ApiOperation({ summary: 'Get Q&A cache statistics' })
  @ApiResponse({ status: 200, description: 'Cache statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCacheStats(@CurrentUser('id') userId: string) {
    const stats = await this.qaCacheService.getCacheStats(userId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Cache statistics retrieved successfully',
      data: stats,
    };
  }
}
