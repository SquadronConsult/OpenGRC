import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { ProjectMember } from './project-member.entity';
import { ChecklistItem } from './checklist-item.entity';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'path_type', type: 'varchar' })
  pathType: '20x' | 'rev5';

  @Column({ name: 'impact_level', type: 'varchar' })
  impactLevel: 'low' | 'moderate' | 'high';

  /** Comma-separated actor labels e.g. CSO,CSX for 20x provider */
  @Column({ name: 'actor_labels', default: 'CSO,CSX' })
  actorLabels: string;

  @Column({ name: 'compliance_start_date', type: 'date', nullable: true })
  complianceStartDate: Date | null;

  @Column({ name: 'frmr_version_id', nullable: true })
  frmrVersionId: string;

  @Column({ name: 'auto_scope_config', type: 'simple-json', nullable: true })
  autoScopeConfig: Record<string, unknown> | null;

  @Column({ name: 'auto_scope_last_run_at', type: 'datetime', nullable: true })
  autoScopeLastRunAt: Date | null;

  @Column({ name: 'owner_id', nullable: true })
  ownerId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => ProjectMember, (m) => m.project)
  members: ProjectMember[];

  @OneToMany(() => ChecklistItem, (c) => c.project)
  checklistItems: ChecklistItem[];
}
