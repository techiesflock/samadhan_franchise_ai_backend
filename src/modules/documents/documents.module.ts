import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentEntity } from '../../entities/document.entity';
import { FolderEntity } from '../../entities/folder.entity';
import { IngestionModule } from '../ingestion/ingestion.module';
import { VectorModule } from '../vector/vector.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity, FolderEntity]),
    IngestionModule, 
    VectorModule
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule { }
