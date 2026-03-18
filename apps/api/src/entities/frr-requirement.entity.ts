import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { FrmrVersion } from './frmr-version.entity';

@Entity('frr_requirements')
@Index(['versionId', 'processId', 'layer', 'actorLabel', 'reqKey', 'impactLevel'])
export class FrrRequirement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'version_id' })
  versionId: string;

  @ManyToOne(() => FrmrVersion, (v) => v.requirements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'version_id' })
  version: FrmrVersion;

  @Column({ name: 'process_id' })
  processId: string;

  @Column({ type: 'varchar' })
  layer: 'both' | '20x' | 'rev5';

  @Column({ name: 'actor_label' })
  actorLabel: string;

  @Column({ name: 'req_key' })
  reqKey: string;

  @Column({ nullable: true })
  name: string;

  @Column({ type: 'text' })
  statement: string;

  @Column({ name: 'primary_key_word', nullable: true })
  primaryKeyWord: string;

  @Column({ type: 'simple-json', nullable: true })
  affects: string[];

  @Column({ type: 'simple-json', nullable: true })
  terms: string[];

  @Column({ name: 'timeframe_type', nullable: true })
  timeframeType: string;

  @Column({ name: 'timeframe_num', type: 'int', nullable: true })
  timeframeNum: number;

  /** low | moderate | high when expanded from varies_by_level */
  @Column({ name: 'impact_level', nullable: true })
  impactLevel: string;

  @Column({ type: 'simple-json', nullable: true })
  raw: Record<string, unknown>;
}
