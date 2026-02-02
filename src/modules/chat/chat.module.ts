import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { GeminiService } from './services/gemini.service';
import { QACacheService } from './services/qa-cache.service';
import { FileProcessorService } from './services/file-processor.service';
import { VectorModule } from '../vector/vector.module';
import { ChatSessionEntity } from '../../entities/chat-session.entity';
import { QACache } from './entities/qa-cache.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatSessionEntity, QACache]),
    VectorModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, GeminiService, QACacheService, FileProcessorService],
  exports: [ChatService, GeminiService, QACacheService],
})
export class ChatModule { }
