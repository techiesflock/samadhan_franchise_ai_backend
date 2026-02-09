import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { UserEntity } from './user.entity';
import { FolderEntity } from './folder.entity';

@Entity('documents')
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => UserEntity, user => user.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @Column({ nullable: true })
  folderId: string;

  @ManyToOne(() => FolderEntity, folder => folder.documents, { 
    onDelete: 'SET NULL',
    nullable: true 
  })
  @JoinColumn({ name: 'folderId' })
  folder: FolderEntity;

  @Column()
  fileName: string;

  @Column()
  originalName: string;

  @Column()
  filePath: string;

  @Column({ type: 'bigint' })
  fileSize: number;

  @Column()
  mimeType: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'processing' | 'completed' | 'failed';

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ type: 'text', nullable: true })
  extractedContent: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata: {
    keywords?: string[];
    category?: string;
    tags?: string[];
  };

  @CreateDateColumn()
  uploadedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
