import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Project } from './project.entity';
import { User } from './user.entity';
import { IncidentControlImpact } from './incident-control-impact.entity';

@Entity('incidents')
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'varchar' })
  severity: 'P1' | 'P2' | 'P3' | 'P4';

  @Column({ type: 'varchar' })
  status: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'impact_assessment', type: 'text', nullable: true })
  impactAssessment: string | null;

  @Column({ name: 'root_cause', type: 'text', nullable: true })
  rootCause: string | null;

  @Column({ name: 'owner_user_id', type: 'varchar', nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;

  @OneToMany(() => IncidentControlImpact, (i) => i.incident)
  controlImpacts: IncidentControlImpact[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
