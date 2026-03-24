import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Asset } from './asset.entity';
import { InternalControl } from './internal-control.entity';

@Entity('asset_control_mappings')
export class AssetControlMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'asset_id' })
  assetId: string;

  @ManyToOne(() => Asset, (a) => a.controlMappings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @Column({ name: 'internal_control_id' })
  internalControlId: string;

  @ManyToOne(() => InternalControl, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'internal_control_id' })
  internalControl: InternalControl;
}
