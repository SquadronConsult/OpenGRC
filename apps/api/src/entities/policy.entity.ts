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
import { datetimeColumnType } from '../db/column-types';
import { Project } from './project.entity';
import { User } from './user.entity';
import { PolicyVersion } from './policy-version.entity';
import { PolicyControlMapping } from './policy-control-mapping.entity';
import { PolicyAttestation } from './policy-attestation.entity';

export type PolicyStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'published'
  | 'retired';

@Entity('policies')
export class Policy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', type: 'varchar', nullable: true })
  projectId: string | null;

  @ManyToOne(() => Project, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project | null;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar', default: '1.0.0' })
  version: string;

  @Column({ type: 'varchar' })
  status: PolicyStatus;

  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  @Column({ name: 'owner_user_id', type: 'varchar', nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;

  @Column({ name: 'approver_user_id', type: 'varchar', nullable: true })
  approverUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approver_user_id' })
  approver: User | null;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'effective_date', type: datetimeColumnType, nullable: true })
  effectiveDate: Date | null;

  @Column({ name: 'next_review_date', type: datetimeColumnType, nullable: true })
  nextReviewDate: Date | null;

  @OneToMany(() => PolicyVersion, (v) => v.policy)
  versions: PolicyVersion[];

  @OneToMany(() => PolicyControlMapping, (m) => m.policy)
  controlMappings: PolicyControlMapping[];

  @OneToMany(() => PolicyAttestation, (a) => a.policy)
  attestations: PolicyAttestation[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
