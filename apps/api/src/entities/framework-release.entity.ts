import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Framework } from './framework.entity';
import { CatalogControl } from './catalog-control.entity';
import { CatalogRequirement } from './catalog-requirement.entity';
import { FrmrVersion } from './frmr-version.entity';

@Entity('framework_releases')
export class FrameworkRelease {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'framework_id', type: 'uuid' })
  frameworkId: string;

  @ManyToOne(() => Framework, (f) => f.releases, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'framework_id' })
  framework: Framework;

  /** Human or machine release label (e.g. FRMR doc version). */
  @Column({ name: 'release_code' })
  releaseCode: string;

  @Column({ type: 'text', nullable: true })
  label: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  /** When this release is produced from a FRMR ingest, links the legacy version row. */
  @Column({ name: 'frmr_version_id', type: 'uuid', nullable: true })
  frmrVersionId: string | null;

  @ManyToOne(() => FrmrVersion, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'frmr_version_id' })
  frmrVersion: FrmrVersion | null;

  @OneToMany(() => CatalogControl, (c) => c.frameworkRelease)
  controls: CatalogControl[];

  @OneToMany(() => CatalogRequirement, (r) => r.frameworkRelease)
  requirements: CatalogRequirement[];
}
