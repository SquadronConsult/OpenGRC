import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RiskAcceptanceRequest } from './risk-acceptance-request.entity';
import { User } from './user.entity';

@Entity('risk_acceptance_steps')
@Index(['requestId', 'orderIndex'])
export class RiskAcceptanceStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'request_id' })
  requestId: string;

  @ManyToOne(() => RiskAcceptanceRequest, (r) => r.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id' })
  request: RiskAcceptanceRequest;

  /** 0 = first reviewer, 1 = final approver, etc. */
  @Column({ name: 'order_index', type: 'int' })
  orderIndex: number;

  @Column({ name: 'approver_user_id' })
  approverUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approver_user_id' })
  approver: User;

  /** pending | approved | rejected | skipped */
  @Column({ type: 'varchar', default: 'pending' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'acted_at', type: 'datetime', nullable: true })
  actedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
