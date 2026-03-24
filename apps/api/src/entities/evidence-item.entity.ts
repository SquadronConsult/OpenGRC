import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { datetimeColumnType } from '../db/column-types';
import { EvidenceReviewState } from './enums/grc-enums';
import { ChecklistItem } from './checklist-item.entity';
import { User } from './user.entity';

@Entity('evidence_items')
@Index(['checklistItemId'])
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
  @Column({
    name: 'review_state',
    type: 'varchar',
    length: 32,
    nullable: true,
    enum: EvidenceReviewState,
  })
  reviewState: EvidenceReviewState | null;

  @Column({ name: 'artifact_type', type: 'varchar', nullable: true })
  artifactType: string | null;

  @Column({ name: 'source_system', type: 'varchar', nullable: true })
  sourceSystem: string | null;

  @Column({ name: 'collection_start', type: datetimeColumnType, nullable: true })
  collectionStart: Date | null;

  @Column({ name: 'collection_end', type: datetimeColumnType, nullable: true })
  collectionEnd: Date | null;

  @Column({ name: 'uploaded_by_id', type: 'varchar', nullable: true })
  uploadedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy: User;

  @Column({ name: 'expires_at', type: datetimeColumnType, nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'superseded_by_id', type: 'varchar', nullable: true })
  supersededById: string | null;

  @ManyToOne(() => EvidenceItem, { nullable: true })
  @JoinColumn({ name: 'superseded_by_id' })
  supersededBy: EvidenceItem | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
