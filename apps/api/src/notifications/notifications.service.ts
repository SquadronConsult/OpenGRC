import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { toPaginated } from '../common/pagination/paginated-result';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  async notify(
    userId: string,
    type: string,
    payload: Record<string, unknown>,
  ) {
    return this.repo.save(this.repo.create({ userId, type, payload }));
  }

  listForUser(userId: string) {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async listForUserPaginated(
    userId: string,
    paging: { skip: number; take: number; page: number; limit: number },
  ) {
    const base = this.repo
      .createQueryBuilder('n')
      .where('n.userId = :uid', { uid: userId });
    const total = await base.getCount();
    const rows = await base
      .clone()
      .orderBy('n.created_at', 'DESC')
      .skip(paging.skip)
      .take(paging.take)
      .getMany();
    return toPaginated(rows, paging.page, paging.limit, total);
  }

  async markRead(id: string, userId: string) {
    await this.repo.update({ id, userId }, { readAt: new Date() });
  }
}
