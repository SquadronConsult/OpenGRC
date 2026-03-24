import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { datetimeColumnType } from '../db/column-types';
import { RiskStatus } from './enums/grc-enums';
import { Project } from './project.entity';
import { User } from './user.entity';
import { RiskChecklistMitigation } from './risk-checklist-mitigation.entity';
import { RiskInternalControlMitigation } from './risk-internal-control-mitigation.entity';

@Entity('risks')
@Index(['projectId'])
export class Risk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Free-form category e.g. operational, strategic, compliance */
  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  /** 1–5 */
  @Column({ type: 'int' })
  likelihood: number;

  /** 1–5 */
  @Column({ type: 'int' })
  impact: number;

  @Column({ name: 'inherent_score', type: 'int' })
  inherentScore: number;

  /** Post-mitigation likelihood 1–5 */
  @Column({ name: 'residual_likelihood', type: 'int', nullable: true })
  residualLikelihood: number | null;

  /** Post-mitigation impact 1–5 */
  @Column({ name: 'residual_impact', type: 'int', nullable: true })
  residualImpact: number | null;

  @Column({ name: 'residual_score', type: 'int', nullable: true })
  residualScore: number | null;

  /** Required when residual would exceed inherent without justification */
  @Column({ name: 'residual_override_reason', type: 'text', nullable: true })
  residualOverrideReason: string | null;

  /** draft | open | treating | accepted | closed */
  @Column({
    type: 'varchar',
    length: 24,
    enum: RiskStatus,
    default: RiskStatus.Open,
  })
  status: RiskStatus;

  @Column({ name: 'owner_user_id', type: 'varchar', nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;

  /** within | outside | pending — vs risk appetite */
  @Column({ name: 'appetite_decision', type: 'varchar', nullable: true })
  appetiteDecision: string | null;

  @Column({ name: 'acceptance_expires_at', type: datetimeColumnType, nullable: true })
  acceptanceExpiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => RiskChecklistMitigation, (m) => m.risk)
  checklistMitigations: RiskChecklistMitigation[];

  @OneToMany(() => RiskInternalControlMitigation, (m) => m.risk)
  internalControlMitigations: RiskInternalControlMitigation[];
}
