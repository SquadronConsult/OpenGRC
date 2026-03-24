import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { datetimeColumnType } from '../db/column-types';
import { Project } from './project.entity';
import { ChecklistItem } from './checklist-item.entity';
import { IntegrationConnectorRun } from './integration-connector-run.entity';

@Entity('control_test_results')
export class ControlTestResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'checklist_item_id' })
  checklistItemId: string;

  @ManyToOne(() => ChecklistItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'checklist_item_id' })
  checklistItem: ChecklistItem;

  @Column({ name: 'test_type', type: 'varchar' })
  testType: 'automated' | 'manual';

  @Column({ type: 'varchar' })
  result: 'pass' | 'fail' | 'not_tested';

  @Column({ name: 'tested_at', type: datetimeColumnType, nullable: true })
  testedAt: Date | null;

  @Column({ name: 'next_test_date', type: datetimeColumnType, nullable: true })
  nextTestDate: Date | null;

  @Column({ name: 'connector_run_id', type: 'uuid', nullable: true })
  connectorRunId: string | null;

  @ManyToOne(() => IntegrationConnectorRun, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'connector_run_id' })
  connectorRun: IntegrationConnectorRun | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
