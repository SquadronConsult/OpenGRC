import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Project } from './project.entity';
import { User } from './user.entity';
import { AuditFinding } from './audit-finding.entity';
import { AuditEvidenceRequest } from './audit-evidence-request.entity';

@Entity('grc_audits')
export class GrcAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'varchar' })
  type: 'internal' | 'external' | '3pao';

  @Column({ type: 'varchar' })
  status:
    | 'planned'
    | 'fieldwork'
    | 'draft_report'
    | 'final_report'
    | 'closed';

  @Column({ name: 'lead_auditor_user_id', type: 'varchar', nullable: true })
  leadAuditorUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'lead_auditor_user_id' })
  leadAuditor: User | null;

  @Column({ type: 'text', nullable: true })
  scope: string | null;

  @Column({ name: 'planned_start', type: 'datetime', nullable: true })
  plannedStart: Date | null;

  @Column({ name: 'planned_end', type: 'datetime', nullable: true })
  plannedEnd: Date | null;

  @OneToMany(() => AuditFinding, (f) => f.audit)
  findings: AuditFinding[];

  @OneToMany(() => AuditEvidenceRequest, (r) => r.audit)
  evidenceRequests: AuditEvidenceRequest[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
