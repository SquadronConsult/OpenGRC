import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('webhook_subscriptions')
export class WebhookSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', nullable: true })
  projectId: string;

  @Column()
  url: string;

  @Column({ nullable: true })
  secret: string;

  @Column({ type: 'simple-json' })
  events: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
