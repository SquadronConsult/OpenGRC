import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { InternalControl } from './internal-control.entity';
import { CatalogRequirement } from './catalog-requirement.entity';

@Entity('internal_control_mappings')
@Index(['internalControlId', 'catalogRequirementId'], { unique: true })
export class InternalControlMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'internal_control_id' })
  internalControlId: string;

  @ManyToOne(() => InternalControl, (ic) => ic.mappings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'internal_control_id' })
  internalControl: InternalControl;

  @Column({ name: 'catalog_requirement_id' })
  catalogRequirementId: string;

  @ManyToOne(() => CatalogRequirement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'catalog_requirement_id' })
  catalogRequirement: CatalogRequirement;

  /** Mirrors Framework.code for priority ordering (nist_csf_2 before soc2_tsc, etc.). */
  @Column({ name: 'framework_code', type: 'varchar', nullable: true })
  frameworkCode: string | null;

  @Column({ type: 'varchar', default: 'full' })
  mappingType: string;

  @Column({ type: 'float', nullable: true })
  coverage: number | null;

  @Column({ type: 'text', nullable: true })
  rationale: string | null;

  @Column({ type: 'varchar', nullable: true })
  source: string | null;

  @Column({ name: 'priority_rank', type: 'int', default: 0 })
  priorityRank: number;
}
