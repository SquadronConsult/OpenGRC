import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { FrameworkRelease } from './framework-release.entity';
import { CatalogControl } from './catalog-control.entity';

@Entity('catalog_requirements')
@Index(['frameworkReleaseId', 'requirementCode'], { unique: true })
export class CatalogRequirement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'framework_release_id' })
  frameworkReleaseId: string;

  @ManyToOne(() => FrameworkRelease, (r) => r.requirements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'framework_release_id' })
  frameworkRelease: FrameworkRelease;

  @Column({ name: 'catalog_control_id', type: 'varchar', nullable: true })
  catalogControlId: string | null;

  @ManyToOne(() => CatalogControl, (c) => c.requirements, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'catalog_control_id' })
  catalogControl: CatalogControl | null;

  /** Stable code for APIs/MCP (e.g. frr:CSO:P1:reqKey or ksi:IND-01). */
  @Column({ name: 'requirement_code' })
  requirementCode: string;

  @Column({ type: 'text' })
  statement: string;

  @Column({ type: 'varchar', default: 'generic' })
  kind: 'frr' | 'ksi' | 'generic';

  @Column({ name: 'source_frr_id', type: 'varchar', nullable: true })
  sourceFrrId: string | null;

  @Column({ name: 'source_ksi_id', type: 'varchar', nullable: true })
  sourceKsiId: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;
}
