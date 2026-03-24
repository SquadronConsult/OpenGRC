import {
  BeforeInsert,
  BeforeUpdate,
  Check,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Policy } from './policy.entity';
import { CatalogRequirement } from './catalog-requirement.entity';
import { InternalControl } from './internal-control.entity';

@Entity('policy_control_mappings')
@Index(['policyId'])
@Index(['catalogRequirementId'])
@Index(['internalControlId'])
@Check(
  `"catalog_requirement_id" IS NOT NULL OR "internal_control_id" IS NOT NULL`,
)
export class PolicyControlMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'policy_id' })
  policyId: string;

  @ManyToOne(() => Policy, (p) => p.controlMappings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_id' })
  policy: Policy;

  @Column({ name: 'catalog_requirement_id', type: 'uuid', nullable: true })
  catalogRequirementId: string | null;

  @ManyToOne(() => CatalogRequirement, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'catalog_requirement_id' })
  catalogRequirement: CatalogRequirement | null;

  @Column({ name: 'internal_control_id', type: 'uuid', nullable: true })
  internalControlId: string | null;

  @ManyToOne(() => InternalControl, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'internal_control_id' })
  internalControl: InternalControl | null;

  @BeforeInsert()
  @BeforeUpdate()
  assertAtLeastOneTarget(): void {
    if (this.catalogRequirementId == null && this.internalControlId == null) {
      throw new Error(
        'PolicyControlMapping requires catalogRequirementId or internalControlId',
      );
    }
  }
}
