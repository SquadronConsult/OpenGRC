import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('detector_findings')
@Index(['projectId', 'runId'])
@Index(['projectId', 'key'])
export class DetectorFinding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ name: 'run_id' })
  runId: string;

  @Column({ name: 'source' })
  source: string;

  @Column({ name: 'key' })
  key: string;

  @Column({ name: 'value_type', default: 'string' })
  valueType: string;

  @Column({ name: 'value', type: 'simple-json', nullable: true })
  value: unknown;

  @Column({ name: 'strength', type: 'float', default: 0.5 })
  strength: number;

  @Column({ name: 'rationale', type: 'text', nullable: true })
  rationale: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
