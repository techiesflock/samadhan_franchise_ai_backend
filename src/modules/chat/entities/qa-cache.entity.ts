import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('qa_cache')
@Index(['userId', 'createdAt'])
@Index(['question'])
export class QACache {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  userId: string;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'text' })
  answer: string;

  @Column({ type: 'varchar', length: 50, default: 'ai_generated' })
  source: string; // 'ai_generated', 'document_rag', 'cached'

  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string; // Which model generated this

  @Column({ type: 'simple-array', nullable: true })
  documentSources: string[]; // Which documents were used

  @Column({ type: 'int', default: 1 })
  usageCount: number; // How many times this was returned

  @Column({ type: 'text', nullable: true })
  embedding: string; // Store question embedding for semantic search

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date;
}
