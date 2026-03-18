import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApplicabilityRecommendation } from './applicability-recommendation.entity';

@Entity('review_decisions')
@Index(['projectId', 'recommendationId'])
export class ReviewDecision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ name: 'recommendation_id' })
  recommendationId: string;

  @ManyToOne(() => ApplicabilityRecommendation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recommendation_id' })
  recommendation: ApplicabilityRecommendation;

  @Column({ name: 'reviewer_id' })
  reviewerId: string;

  @Column({ name: 'decision' })
  decision: 'approved' | 'rejected';

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
