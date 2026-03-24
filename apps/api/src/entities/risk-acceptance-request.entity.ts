import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Risk } from './risk.entity';
import { Project } from './project.entity';
import { User } from './user.entity';
import { RiskAcceptanceStep } from './risk-acceptance-step.entity';

@Entity('risk_acceptance_requests')
@Index(['riskId'])
@Index(['projectId'])
export class RiskAcceptanceRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'risk_id' })
  riskId: string;

  @ManyToOne(() => Risk, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'risk_id' })
  risk: Risk;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  /** draft | submitted | approved | rejected | cancelled */
  @Column({ type: 'varchar', default: 'draft' })
  status: string;

  @Column({ name: 'submitted_by_id', nullable: true })
  submittedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'submitted_by_id' })
  submittedBy: User | null;

  @Column({ name: 'submitted_at', type: 'datetime', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => RiskAcceptanceStep, (s) => s.request, { cascade: true })
  steps: RiskAcceptanceStep[];
}
