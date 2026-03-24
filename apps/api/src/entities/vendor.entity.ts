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
import { VendorAssessment } from './vendor-assessment.entity';
import { VendorControlMapping } from './vendor-control-mapping.entity';

@Entity('vendors')
export class Vendor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  criticality: string | null;

  @Column({ type: 'varchar' })
  status: string;

  @OneToMany(() => VendorAssessment, (a) => a.vendor)
  assessments: VendorAssessment[];

  @OneToMany(() => VendorControlMapping, (m) => m.vendor)
  controlMappings: VendorControlMapping[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
