import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { DocumentEntity } from '../../entities/document.entity';
import { FolderEntity } from '../../entities/folder.entity';
import { VectorModule } from '../vector/vector.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity, FolderEntity]),
    VectorModule,
    ChatModule,
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
