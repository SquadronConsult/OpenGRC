import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Incident } from './incident.entity';
import { ChecklistItem } from './checklist-item.entity';

@Entity('incident_control_impacts')
export class IncidentControlImpact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'incident_id' })
  incidentId: string;

  @ManyToOne(() => Incident, (i) => i.controlImpacts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_id' })
  incident: Incident;

  @Column({ name: 'checklist_item_id' })
  checklistItemId: string;

  @ManyToOne(() => ChecklistItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'checklist_item_id' })
  checklistItem: ChecklistItem;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
