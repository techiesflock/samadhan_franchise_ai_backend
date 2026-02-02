import { Module } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { VectorModule } from '../vector/vector.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [VectorModule, ChatModule],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule { }
