import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
  ) {}

  log(
    actorId: string | null,
    action: string,
    entityType: string,
    entityId: string | null,
    payload?: Record<string, unknown>,
  ) {
    const row = this.repo.create({
      actorId: actorId ?? undefined,
      action,
      entityType,
      entityId: entityId ?? undefined,
      payload,
    });
    return this.repo.save(row);
  }
}
