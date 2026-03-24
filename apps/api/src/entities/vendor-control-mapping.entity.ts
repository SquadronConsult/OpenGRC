import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Vendor } from './vendor.entity';
import { InternalControl } from './internal-control.entity';

@Entity('vendor_control_mappings')
export class VendorControlMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vendor_id' })
  vendorId: string;

  @ManyToOne(() => Vendor, (v) => v.controlMappings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @Column({ name: 'internal_control_id' })
  internalControlId: string;

  @ManyToOne(() => InternalControl, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'internal_control_id' })
  internalControl: InternalControl;
}
