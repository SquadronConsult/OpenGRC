import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { FrmrVersion } from './frmr-version.entity';

@Entity('frd_terms')
@Index(['versionId', 'stableId'], { unique: true })
export class FrdTerm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'version_id' })
  versionId: string;

  @ManyToOne(() => FrmrVersion, (v) => v.terms, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'version_id' })
  version: FrmrVersion;

  @Column({ name: 'stable_id' })
  stableId: string;

  @Column()
  term: string;

  @Column({ type: 'simple-json', nullable: true })
  alts: string[];

  @Column({ type: 'text' })
  definition: string;

  @Column({ type: 'simple-json', nullable: true })
  updated: unknown[];
}
