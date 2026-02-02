import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { IngestionModule } from '../ingestion/ingestion.module';
import { VectorModule } from '../vector/vector.module';

@Module({
  imports: [IngestionModule, VectorModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule { }
