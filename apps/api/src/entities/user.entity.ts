import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { datetimeColumnType } from '../db/column-types';
import { ProjectMember } from './project-member.entity';

export type UserRole = 'admin' | 'csp_manager' | 'engineer' | 'assessor' | 'agency_reviewer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ nullable: true })
  name: string;

  @Column({ type: 'varchar', default: 'csp_manager' })
  role: UserRole;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'password_set_at', type: datetimeColumnType, nullable: true })
  passwordSetAt: Date | null;

  @Column({ name: 'last_login_at', type: datetimeColumnType, nullable: true })
  lastLoginAt: Date | null;

  @Column({ name: 'failed_login_attempts', type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Column({ name: 'locked_until', type: datetimeColumnType, nullable: true })
  lockedUntil: Date | null;

  /** True until the user sets a new password after initial env-based admin login. */
  @Column({ name: 'must_change_password', type: 'boolean', default: false })
  mustChangePassword: boolean;

  /** local | oidc | ... — OIDC-ready linkage */
  @Column({ name: 'auth_provider', type: 'varchar', default: 'local' })
  authProvider: string;

  @Column({ name: 'auth_subject', type: 'varchar', nullable: true })
  authSubject: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => ProjectMember, (m) => m.user)
  memberships: ProjectMember[];
}
