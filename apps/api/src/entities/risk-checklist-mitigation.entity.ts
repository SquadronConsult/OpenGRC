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
import { ChecklistItem } from './checklist-item.entity';

@Entity('risk_checklist_mitigations')
@Unique(['riskId', 'checklistItemId'])
@Index(['riskId'])
@Index(['checklistItemId'])
export class RiskChecklistMitigation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'risk_id' })
  riskId: string;

  @ManyToOne(() => Risk, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'risk_id' })
  risk: Risk;

  @Column({ name: 'checklist_item_id' })
  checklistItemId: string;

  @ManyToOne(() => ChecklistItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'checklist_item_id' })
  checklistItem: ChecklistItem;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
