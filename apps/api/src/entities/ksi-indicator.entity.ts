import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { FrmrVersion } from './frmr-version.entity';

@Entity('ksi_indicators')
@Index(['versionId', 'indicatorId'], { unique: true })
export class KsiIndicator {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'version_id' })
  versionId: string;

  @ManyToOne(() => FrmrVersion, (v) => v.ksiIndicators, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'version_id' })
  version: FrmrVersion;

  @Column({ name: 'domain_code' })
  domainCode: string;

  @Column({ name: 'domain_name', nullable: true })
  domainName: string;

  @Column({ name: 'indicator_id' })
  indicatorId: string;

  @Column({ nullable: true })
  name: string;

  @Column({ type: 'text' })
  statement: string;

  @Column({ type: 'simple-json', nullable: true })
  controls: string[];

  @Column({ type: 'simple-json', nullable: true })
  terms: string[];

  @Column({ type: 'simple-json', nullable: true })
  raw: Record<string, unknown>;

  @Column({ default: false })
  isProcessKsi: boolean;
}
