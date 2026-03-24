import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { FrameworkRelease } from './framework-release.entity';
import { CatalogRequirement } from './catalog-requirement.entity';

@Entity('catalog_controls')
export class CatalogControl {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'framework_release_id', type: 'uuid' })
  frameworkReleaseId: string;

  @ManyToOne(() => FrameworkRelease, (r) => r.controls, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'framework_release_id' })
  frameworkRelease: FrameworkRelease;

  /** Framework-specific grouping (e.g. FRMR process id). */
  @Column({ name: 'control_code' })
  controlCode: string;

  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => CatalogRequirement, (req) => req.catalogControl)
  requirements: CatalogRequirement[];
}
