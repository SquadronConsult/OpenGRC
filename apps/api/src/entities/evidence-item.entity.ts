import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ChecklistItem } from './checklist-item.entity';
import { User } from './user.entity';

@Entity('evidence_items')
export class EvidenceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'checklist_item_id' })
  checklistItemId: string;

  @ManyToOne(() => ChecklistItem, (c) => c.evidence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'checklist_item_id' })
  checklistItem: ChecklistItem;

  @Column({ name: 'storage_key', type: 'varchar', nullable: true })
  storageKey: string | null;

  @Column({ type: 'varchar', nullable: true })
  filename: string | null;

  @Column({ type: 'varchar', nullable: true })
  checksum: string | null;

  @Column({ name: 'external_uri', type: 'text', nullable: true })
  externalUri: string | null;

  @Column({ name: 'source_connector', type: 'varchar', nullable: true })
  sourceConnector: string | null;

  @Column({ name: 'metadata', type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'uploaded_by_id', type: 'varchar', nullable: true })
  uploadedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
