import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Vendor } from './vendor.entity';

@Entity('vendor_assessments')
export class VendorAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vendor_id' })
  vendorId: string;

  @ManyToOne(() => Vendor, (v) => v.assessments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @Column({ name: 'risk_score', type: 'float', nullable: true })
  riskScore: number | null;

  @Column({ name: 'questionnaire', type: 'simple-json', nullable: true })
  questionnaire: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  findings: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
