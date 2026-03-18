import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { FrdTerm } from './frd-term.entity';
import { FrrRequirement } from './frr-requirement.entity';
import { KsiIndicator } from './ksi-indicator.entity';

@Entity('frmr_versions')
export class FrmrVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'frmr_release' })
  frmrRelease: string;

  @Column({ name: 'last_updated' })
  lastUpdated: string;

  @Column({ name: 'source_checksum', nullable: true })
  sourceChecksum: string;

  @Column({ name: 'raw_snapshot', type: 'simple-json', nullable: true })
  rawSnapshot: Record<string, unknown> | null;

  @Column({ name: 'parse_ok', default: true })
  parseOk: boolean;

  @Column({ name: 'parse_errors', type: 'simple-json', nullable: true })
  parseErrors: string[] | null;

  @CreateDateColumn({ name: 'ingested_at' })
  ingestedAt: Date;

  @OneToMany(() => FrdTerm, (t) => t.version)
  terms: FrdTerm[];

  @OneToMany(() => FrrRequirement, (r) => r.version)
  requirements: FrrRequirement[];

  @OneToMany(() => KsiIndicator, (k) => k.version)
  ksiIndicators: KsiIndicator[];
}
