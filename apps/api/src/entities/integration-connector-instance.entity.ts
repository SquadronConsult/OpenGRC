import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { datetimeColumnType } from '../db/column-types';
import { Project } from './project.entity';
import { IntegrationConnectorRun } from './integration-connector-run.entity';

@Entity('integration_connector_instances')
export class IntegrationConnectorInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  /** Registry id, e.g. github_repo, aws_cloudtrail, synthetic */
  @Column({ name: 'connector_id' })
  connectorId: string;

  @Column({ type: 'varchar' })
  label: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  /** JSON: provider tokens, repo paths, default control mapping, pollIntervalMinutes */
  @Column({ name: 'config_json', type: 'text' })
  configJson: string;

  /** Optional link to an integration_credentials row for rotation tracking; secrets remain in config_json. */
  @Column({ name: 'linked_credential_id', type: 'uuid', nullable: true })
  linkedCredentialId: string | null;

  /** Opaque cursor/watermark for incremental collection */
  @Column({ name: 'cursor', type: 'text', nullable: true })
  cursor: string | null;

  @Column({ name: 'last_run_at', type: datetimeColumnType, nullable: true })
  lastRunAt: Date | null;

  @Column({ name: 'last_success_at', type: datetimeColumnType, nullable: true })
  lastSuccessAt: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'recollection_enabled', type: 'boolean', default: false })
  recollectionEnabled: boolean;

  @Column({
    name: 'recollection_interval_days',
    type: 'int',
    nullable: true,
  })
  recollectionIntervalDays: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => IntegrationConnectorRun, (r) => r.instance)
  runs: IntegrationConnectorRun[];
}
