import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { datetimeColumnType } from '../db/column-types';
import { IntegrationConnectorInstance } from './integration-connector-instance.entity';

@Entity('integration_connector_runs')
export class IntegrationConnectorRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'instance_id', type: 'uuid' })
  instanceId: string;

  @ManyToOne(() => IntegrationConnectorInstance, (i) => i.runs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'instance_id' })
  instance: IntegrationConnectorInstance;

  @Column({ type: 'varchar', default: 'running' })
  status: 'running' | 'success' | 'failed';

  @Column({ name: 'started_at', type: datetimeColumnType })
  startedAt: Date;

  @Column({ name: 'finished_at', type: datetimeColumnType, nullable: true })
  finishedAt: Date | null;

  @Column({ name: 'items_accepted', type: 'int', default: 0 })
  itemsAccepted: number;

  @Column({ name: 'items_rejected', type: 'int', default: 0 })
  itemsRejected: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'simple-json', nullable: true })
  diagnostics: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
