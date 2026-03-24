import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Policy } from './policy.entity';
import { User } from './user.entity';

@Entity('policy_versions')
export class PolicyVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'policy_id' })
  policyId: string;

  @ManyToOne(() => Policy, (p) => p.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_id' })
  policy: Policy;

  @Column({ name: 'version_number', type: 'varchar' })
  versionNumber: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'change_description', type: 'text', nullable: true })
  changeDescription: string | null;

  @Column({ name: 'author_user_id', type: 'varchar', nullable: true })
  authorUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'author_user_id' })
  author: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
