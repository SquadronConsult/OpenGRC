import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('source_snapshots')
@Index(['projectId', 'runId'])
export class SourceSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ name: 'run_id' })
  runId: string;

  @Column({ name: 'source_type' })
  sourceType: string;

  @Column({ name: 'status', default: 'success' })
  status: string;

  @Column({ name: 'summary', type: 'simple-json', nullable: true })
  summary: Record<string, unknown> | null;

  @Column({ name: 'data', type: 'simple-json', nullable: true })
  data: Record<string, unknown> | null;

  @Column({ name: 'error', type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
