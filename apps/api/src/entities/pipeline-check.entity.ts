import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from './project.entity';

@Entity('pipeline_checks')
export class PipelineCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'varchar' })
  status: 'pass' | 'fail';

  @Column({ type: 'text', nullable: true })
  detail: string | null;

  @Column({ name: 'external_ref', type: 'varchar', nullable: true })
  externalRef: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
