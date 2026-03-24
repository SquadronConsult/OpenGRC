import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { ChecklistItemStatus } from './enums/grc-enums';
import { datetimeColumnType } from '../db/column-types';
import { Project } from './project.entity';
import { User } from './user.entity';
import { FrrRequirement } from './frr-requirement.entity';
import { KsiIndicator } from './ksi-indicator.entity';
import { CatalogRequirement } from './catalog-requirement.entity';
import { EvidenceItem } from './evidence-item.entity';
import { Finding } from './finding.entity';

@Entity('checklist_items')
export class ChecklistItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => Project, (p) => p.checklistItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'frr_requirement_id', nullable: true })
  frrRequirementId: string;

  @ManyToOne(() => FrrRequirement, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'frr_requirement_id' })
  frrRequirement: FrrRequirement;

  @Column({ name: 'ksi_indicator_id', nullable: true })
  ksiIndicatorId: string;

  @ManyToOne(() => KsiIndicator, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ksi_indicator_id' })
  ksiIndicator: KsiIndicator;

  /** Unified catalog requirement (generic framework model); FRR/KSI remain during rollout. */
  @Column({ name: 'catalog_requirement_id', type: 'uuid', nullable: true })
  catalogRequirementId: string | null;

  @ManyToOne(() => CatalogRequirement, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'catalog_requirement_id' })
  catalogRequirement: CatalogRequirement | null;

  @Column({
    type: 'varchar',
    length: 32,
    enum: ChecklistItemStatus,
    default: ChecklistItemStatus.NotStarted,
  })
  status: ChecklistItemStatus;

  @Column({ name: 'owner_user_id', type: 'varchar', nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  ownerUser: User;

  @Column({ name: 'due_date', type: datetimeColumnType, nullable: true })
  dueDate: Date | null;

  @Column({ name: 'review_state', nullable: true })
  reviewState: string;

  @Column({ name: 'applicability_decision', type: 'varchar', nullable: true })
  applicabilityDecision: 'applicable' | 'not_applicable' | 'inherited' | null;

  @Column({ name: 'applicability_rationale', type: 'text', nullable: true })
  applicabilityRationale: string | null;

  @Column({ name: 'applicability_confidence', type: 'float', nullable: true })
  applicabilityConfidence: number | null;

  @Column({ name: 'applicability_source', type: 'varchar', nullable: true })
  applicabilitySource: string | null;

  @OneToMany(() => EvidenceItem, (e) => e.checklistItem)
  evidence: EvidenceItem[];

  @OneToMany(() => Finding, (f) => f.checklistItem)
  findings: Finding[];
}
