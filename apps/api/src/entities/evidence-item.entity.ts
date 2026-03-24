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

  /** draft | ready_for_review | accepted | rejected | expired */
  @Column({ name: 'review_state', type: 'varchar', nullable: true })
  reviewState: string | null;

  @Column({ name: 'artifact_type', type: 'varchar', nullable: true })
  artifactType: string | null;

  @Column({ name: 'source_system', type: 'varchar', nullable: true })
  sourceSystem: string | null;

  @Column({ name: 'collection_start', type: 'datetime', nullable: true })
  collectionStart: Date | null;

  @Column({ name: 'collection_end', type: 'datetime', nullable: true })
  collectionEnd: Date | null;

  @Column({ name: 'uploaded_by_id', type: 'varchar', nullable: true })
  uploadedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
