import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PolicyService } from './policy.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Policy } from '../entities/policy.entity';

@Injectable()
export class PolicyCronService {
  private readonly log = new Logger(PolicyCronService.name);

  constructor(
    private readonly policies: PolicyService,
    private readonly notifications: NotificationsService,
    @InjectRepository(Policy) private readonly policyRepo: Repository<Policy>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async daily() {
    if (process.env.POLICY_CRON === 'false') return;
    try {
      await this.policies.expirePendingAttestations();
      const soon = new Date();
      soon.setDate(soon.getDate() + 14);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = await this.policyRepo.find({
        where: {
          status: 'published',
          nextReviewDate: LessThanOrEqual(soon),
        },
      });
      const dueFiltered = due.filter(
        (p) => p.nextReviewDate && new Date(p.nextReviewDate) >= today,
      );
      for (const p of dueFiltered) {
        if (p.ownerUserId) {
          await this.notifications.notify(p.ownerUserId, 'policy.review_due', {
            policyId: p.id,
            title: p.title,
            nextReviewDate: p.nextReviewDate,
          });
        }
      }
    } catch (e) {
      this.log.warn(`Policy cron: ${e}`);
    }
  }
}
