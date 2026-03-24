import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Risk } from './risk.entity';
import { InternalControl } from './internal-control.entity';

@Entity('risk_internal_control_mitigations')
@Unique(['riskId', 'internalControlId'])
@Index(['riskId'])
@Index(['internalControlId'])
export class RiskInternalControlMitigation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'risk_id' })
  riskId: string;

  @ManyToOne(() => Risk, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'risk_id' })
  risk: Risk;

  @Column({ name: 'internal_control_id', type: 'uuid' })
  internalControlId: string;

  @ManyToOne(() => InternalControl, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'internal_control_id' })
  internalControl: InternalControl;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
