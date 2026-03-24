import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac } from 'crypto';
import { Repository } from 'typeorm';
import { WebhookSubscription } from '../entities/webhook-subscription.entity';
import { toPaginated } from '../common/pagination/paginated-result';

@Injectable()
export class WebhooksService {
  private readonly log = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(WebhookSubscription)
    private readonly repo: Repository<WebhookSubscription>,
  ) {}

  async deliver(
    projectId: string | null,
    event: string,
    payload: Record<string, unknown>,
  ) {
    const subs = await this.repo.find();
    const body = JSON.stringify({ event, payload, ts: new Date().toISOString() });
    for (const s of subs) {
      if (s.projectId != null) {
        if (projectId == null || s.projectId !== projectId) continue;
      }
      const evs = Array.isArray(s.events) ? s.events : [];
      if (!evs.includes('*') && !evs.includes(event)) continue;
      try {
        const sig = s.secret
          ? createHmac('sha256', s.secret).update(body).digest('hex')
          : '';
        await fetch(s.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sig ? { 'X-GRC-Signature': sig } : {}),
          },
          body,
        });
      } catch (e) {
        this.log.warn(`Webhook failed ${s.url}: ${e}`);
      }
    }
  }

  create(data: Partial<WebhookSubscription>) {
    return this.repo.save(this.repo.create(data));
  }

  list(projectId?: string) {
    return this.repo.find({ where: projectId ? { projectId } : {} });
  }

  listPaginated(
    projectId: string | undefined,
    paging: { skip: number; take: number; page: number; limit: number },
  ) {
    const qb = this.repo.createQueryBuilder('w');
    if (projectId) qb.where('w.projectId = :pid', { pid: projectId });
    return qb
      .orderBy('w.id', 'ASC')
      .skip(paging.skip)
      .take(paging.take)
      .getManyAndCount()
      .then(([items, total]) => toPaginated(items, paging.page, paging.limit, total));
  }
}
