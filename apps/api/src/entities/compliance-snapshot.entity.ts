import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { datetimeColumnType } from '../db/column-types';
import { Project } from './project.entity';

@Entity('compliance_snapshots')
export class ComplianceSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'captured_at', type: datetimeColumnType })
  capturedAt: Date;

  @Column({ name: 'total_controls', type: 'int' })
  totalControls: number;

  @Column({ type: 'int' })
  compliant: number;

  @Column({ name: 'in_progress', type: 'int' })
  inProgress: number;

  @Column({ name: 'non_compliant', type: 'int' })
  nonCompliant: number;

  @Column({ name: 'readiness_pct', type: 'float' })
  readinessPct: number;

  @Column({ name: 'evidence_count', type: 'int' })
  evidenceCount: number;

  @Column({ name: 'expired_evidence_count', type: 'int' })
  expiredEvidenceCount: number;

  @Column({ name: 'open_risk_count', type: 'int' })
  openRiskCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
