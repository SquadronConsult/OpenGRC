import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { FrameworkRelease } from './framework-release.entity';

@Entity('frameworks')
export class Framework {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Stable program id: fedramp_frmr, nist_csf_2, soc2_tsc, iso27001_annex_a, cmmc_2, hipaa_security */
  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @OneToMany(() => FrameworkRelease, (r) => r.framework)
  releases: FrameworkRelease[];
}
