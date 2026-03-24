import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { datetimeColumnType } from '../db/column-types';
import { ChecklistItem } from './checklist-item.entity';

@Entity('applicability_recommendations')
@Index(['projectId', 'runId'])
@Index(['projectId', 'status'])
export class ApplicabilityRecommendation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ name: 'run_id' })
  runId: string;

  @Column({ name: 'checklist_item_id' })
  checklistItemId: string;

  @ManyToOne(() => ChecklistItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'checklist_item_id' })
  checklistItem: ChecklistItem;

  @Column({ name: 'decision' })
  decision: 'applicable' | 'not_applicable' | 'inherited';

  @Column({ name: 'status', default: 'pending_review' })
  status: 'pending_review' | 'approved' | 'rejected' | 'stale';

  @Column({ name: 'rule_id' })
  ruleId: string;

  @Column({ name: 'confidence', type: 'float', default: 0.5 })
  confidence: number;

  @Column({ name: 'rationale', type: 'text' })
  rationale: string;

  @Column({ name: 'matched_facts', type: 'simple-json', nullable: true })
  matchedFacts: string[] | null;

  @Column({ name: 'explainability', type: 'simple-json', nullable: true })
  explainability: Record<string, unknown> | null;

  @Column({ name: 'applied_at', type: datetimeColumnType, nullable: true })
  appliedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
