import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GrcAudit } from './grc-audit.entity';
import { ChecklistItem } from './checklist-item.entity';

@Entity('audit_findings')
export class AuditFinding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'audit_id' })
  auditId: string;

  @ManyToOne(() => GrcAudit, (a) => a.findings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'audit_id' })
  audit: GrcAudit;

  @Column({ type: 'varchar' })
  severity: string;

  @Column({ type: 'varchar' })
  status: 'open' | 'remediation' | 'closed' | 'risk_accepted';

  @Column({ name: 'checklist_item_id', type: 'varchar', nullable: true })
  checklistItemId: string | null;

  @ManyToOne(() => ChecklistItem, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'checklist_item_id' })
  checklistItem: ChecklistItem | null;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'remediation_plan', type: 'text', nullable: true })
  remediationPlan: string | null;

  @Column({ name: 'due_date', type: 'datetime', nullable: true })
  dueDate: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
