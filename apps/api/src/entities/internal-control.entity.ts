import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { InternalControlMapping } from './internal-control-mapping.entity';

@Entity('internal_controls')
export class InternalControl {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @OneToMany(() => InternalControlMapping, (m) => m.internalControl)
  mappings: InternalControlMapping[];
}
