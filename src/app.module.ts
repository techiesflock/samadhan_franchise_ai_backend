import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { VectorModule } from './modules/vector/vector.module';
import { ChatModule } from './modules/chat/chat.module';
import configuration from './config/configuration';
import { UserEntity } from './entities/user.entity';
import { ChatSessionEntity } from './entities/chat-session.entity';
import { DocumentEntity } from './entities/document.entity';
import { QACache } from './modules/chat/entities/qa-cache.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('database.url'),
        entities: [UserEntity, ChatSessionEntity, DocumentEntity, QACache],
        synchronize: true, // ⚠️ Set to false in production, use migrations
        logging: false,
        ssl: {
          rejectUnauthorized: false, // Required for Neon
        },
      }),
    }),
    AuthModule,
    DocumentsModule,
    IngestionModule,
    VectorModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
