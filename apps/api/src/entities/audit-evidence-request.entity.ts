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
import { User } from './user.entity';
import { EvidenceItem } from './evidence-item.entity';

@Entity('audit_evidence_requests')
export class AuditEvidenceRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'audit_id' })
  auditId: string;

  @ManyToOne(() => GrcAudit, (a) => a.evidenceRequests, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'audit_id' })
  audit: GrcAudit;

  @Column({ name: 'assignee_user_id', type: 'varchar', nullable: true })
  assigneeUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assignee_user_id' })
  assignee: User | null;

  @Column({ type: 'varchar' })
  status: 'requested' | 'provided' | 'accepted' | 'insufficient';

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'evidence_item_id', type: 'varchar', nullable: true })
  evidenceItemId: string | null;

  @ManyToOne(() => EvidenceItem, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'evidence_item_id' })
  evidenceItem: EvidenceItem | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
