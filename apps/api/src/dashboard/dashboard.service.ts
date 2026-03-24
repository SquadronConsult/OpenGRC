import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChecklistItem } from '../entities/checklist-item.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { Project } from '../entities/project.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(ChecklistItem)
    private readonly checklistRepo: Repository<ChecklistItem>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  async getStats(projectId?: string) {
    const projects = projectId
      ? 1
      : await this.projectRepo.count();

    const countQb = this.checklistRepo
      .createQueryBuilder('ci')
      .select('ci.status', 'status')
      .addSelect('COUNT(*)', 'count');

    if (projectId) {
      countQb.where('ci.projectId = :projectId', { projectId });
    }

    const statusRows = await countQb
      .groupBy('ci.status')
      .getRawMany<{ status: string; count: string }>();

    const countMap: Record<string, number> = {};
    let totalControls = 0;
    for (const row of statusRows) {
      const n = parseInt(row.count, 10);
      countMap[row.status] = n;
      totalControls += n;
    }

    const compliant = countMap['compliant'] ?? 0;
    const inProgress = countMap['in_progress'] ?? 0;
    const nonCompliant = countMap['non_compliant'] ?? 0;
    const notStarted = countMap['not_started'] ?? 0;
    const readinessPct =
      totalControls > 0
        ? Math.round((compliant / totalControls) * 10000) / 100
        : 0;

    const now = new Date();

    const deadlineQb = this.checklistRepo
      .createQueryBuilder('ci')
      .leftJoinAndSelect('ci.frrRequirement', 'frr')
      .leftJoinAndSelect('ci.catalogRequirement', 'catReq')
      .where('ci.dueDate > :now', { now: now.toISOString() })
      .orderBy('ci.dueDate', 'ASC')
      .take(10);

    if (projectId) {
      deadlineQb.andWhere('ci.projectId = :projectId', { projectId });
    }

    const upcomingItems = await deadlineQb.getMany();

    const upcomingDeadlines = upcomingItems.map((item) => {
      const due = new Date(item.dueDate!);
      const daysRemaining = Math.ceil(
        (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        itemId: item.id,
        controlRef:
          item.catalogRequirement?.requirementCode ??
          item.frrRequirement?.reqKey ??
          '',
        controlName:
          item.catalogRequirement?.statement ??
          item.frrRequirement?.name ??
          '',
        dueDate: due.toISOString(),
        daysRemaining,
        status: item.status,
      };
    });

    return {
      projects,
      totalControls,
      compliant,
      inProgress,
      nonCompliant,
      notStarted,
      readinessPct,
      upcomingDeadlines,
    };
  }

  async getRecentActivity(limit: number) {
    const logs = await this.auditRepo.find({
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });

    return logs.map((log) => {
      const entityLabel = log.entityType.replace(/_/g, ' ');
      const summary = log.entityId
        ? `${log.action} on ${entityLabel} (${log.entityId})`
        : `${log.action} on ${entityLabel}`;

      return {
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId ?? '',
        summary,
        createdAt: log.createdAt.toISOString(),
        userId: log.actorId ?? '',
      };
    });
  }
}
