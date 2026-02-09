import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn, 
  ManyToOne, 
  OneToMany,
  JoinColumn
} from 'typeorm';
import { UserEntity } from './user.entity';
import { DocumentEntity } from './document.entity';

@Entity('folders')
export class FolderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @Column({ nullable: true })
  parentId: string;

  @ManyToOne(() => FolderEntity, folder => folder.children, { 
    onDelete: 'CASCADE',
    nullable: true 
  })
  @JoinColumn({ name: 'parentId' })
  parent: FolderEntity;

  @OneToMany(() => FolderEntity, folder => folder.parent)
  children: FolderEntity[];

  @OneToMany(() => DocumentEntity, document => document.folder)
  documents: DocumentEntity[];

  @Column({ default: 0 })
  documentCount: number;

  @Column({ default: 0 })
  folderCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
