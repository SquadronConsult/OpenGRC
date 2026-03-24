import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
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

  @Column({ name: 'password_set_at', type: 'datetime', nullable: true })
  passwordSetAt: Date | null;

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true })
  lastLoginAt: Date | null;

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
