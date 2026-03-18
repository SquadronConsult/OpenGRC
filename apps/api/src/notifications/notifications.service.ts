import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';

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

  async markRead(id: string, userId: string) {
    await this.repo.update({ id, userId }, { readAt: new Date() });
  }
}
