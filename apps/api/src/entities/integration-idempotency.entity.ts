import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from './project.entity';

@Entity('integration_idempotency')
@Index('uq_integration_idempotency_key', ['projectId', 'requestType', 'idempotencyKey'], {
  unique: true,
})
export class IntegrationIdempotency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'request_type', type: 'varchar' })
  requestType: string;

  @Column({ name: 'idempotency_key', type: 'varchar' })
  idempotencyKey: string;

  @Column({ name: 'request_hash', type: 'varchar' })
  requestHash: string;

  @Column({ type: 'varchar' })
  status: 'accepted' | 'replayed' | 'failed';

  @Column({ name: 'response_payload', type: 'simple-json', nullable: true })
  responsePayload: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

