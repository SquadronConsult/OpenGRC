import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { ChecklistItem } from './checklist-item.entity';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'checklist_item_id', nullable: true })
  checklistItemId: string;

  @ManyToOne(() => ChecklistItem, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'checklist_item_id' })
  checklistItem: ChecklistItem;

  @Column({ name: 'evidence_id', nullable: true })
  evidenceId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'parent_id', nullable: true })
  parentId: string;

  @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolved_by_user_id', type: 'varchar', nullable: true })
  resolvedByUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'resolved_by_user_id' })
  resolvedBy: User | null;

  @Column({ type: 'simple-json', nullable: true })
  mentions: string[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
