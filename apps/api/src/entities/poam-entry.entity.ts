import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from './project.entity';
import { ChecklistItem } from './checklist-item.entity';

/** FedRAMP-style POA&M row persisted for a project (synced from checklist or edited later). */
@Entity('poam_entries')
export class PoamEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'checklist_item_id', type: 'varchar', nullable: true })
  checklistItemId: string | null;

  @ManyToOne(() => ChecklistItem, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'checklist_item_id' })
  checklistItem: ChecklistItem;

  /** Full FedRAMP POA&M row payload (matches export JSON row shape). */
  @Column({ name: 'row_data', type: 'simple-json' })
  rowData: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
