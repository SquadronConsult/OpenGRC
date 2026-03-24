import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from './project.entity';

@Entity('integration_credentials')
export class IntegrationCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'varchar' })
  label: string;

  @Column({ name: 'api_key_hash', type: 'varchar' })
  apiKeyHash: string;

  @Column({ name: 'api_key_prefix', type: 'varchar' })
  apiKeyPrefix: string;

  /**
   * inbound: hashed API keys for machine evidence ingest (default).
   * Outbound connector secrets use connector instance config_json until a vault integration is added.
   */
  @Column({ type: 'varchar', default: 'inbound' })
  kind: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'last_used_at', type: 'datetime', nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

