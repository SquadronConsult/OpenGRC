import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { datetimeColumnType } from '../db/column-types';
import { Policy } from './policy.entity';
import { PolicyVersion } from './policy-version.entity';
import { User } from './user.entity';

export type PolicyAttestationStatus = 'pending' | 'acknowledged' | 'expired';

@Entity('policy_attestations')
export class PolicyAttestation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'policy_id' })
  policyId: string;

  @ManyToOne(() => Policy, (p) => p.attestations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_id' })
  policy: Policy;

  @Column({ name: 'policy_version_id', type: 'varchar', nullable: true })
  policyVersionId: string | null;

  @ManyToOne(() => PolicyVersion, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'policy_version_id' })
  policyVersion: PolicyVersion | null;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'attested_at', type: datetimeColumnType, nullable: true })
  attestedAt: Date | null;

  @Column({ name: 'expires_at', type: datetimeColumnType, nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'varchar' })
  status: PolicyAttestationStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
