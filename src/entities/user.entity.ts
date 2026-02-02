import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ChatSessionEntity } from './chat-session.entity';
import { DocumentEntity } from './document.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  username: string;

  @Column()
  password: string;

  @OneToMany(() => ChatSessionEntity, session => session.user)
  sessions: ChatSessionEntity[];

  @OneToMany(() => DocumentEntity, document => document.user)
  documents: DocumentEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
