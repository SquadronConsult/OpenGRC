import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ChecklistItem } from '../entities/checklist-item.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { Project } from '../entities/project.entity';
import { ComplianceSnapshot } from '../entities/compliance-snapshot.entity';
import { EvidenceItem } from '../entities/evidence-item.entity';
import { Risk } from '../entities/risk.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(ChecklistItem)
    private readonly checklistRepo: Repository<ChecklistItem>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(ComplianceSnapshot)
    private readonly snapshots: Repository<ComplianceSnapshot>,
    @InjectRepository(EvidenceItem)
    private readonly evidenceRepo: Repository<EvidenceItem>,
    @InjectRepository(Risk)
    private readonly riskRepo: Repository<Risk>,
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

  async getTrends(
    projectId: string,
    fromIso: string,
    toIso: string,
    interval: 'daily' | 'weekly' = 'daily',
  ) {
    const from = new Date(fromIso);
    const to = new Date(toIso);
    const rows = await this.snapshots.find({
      where: {
        projectId,
        capturedAt: Between(from, to),
      },
      order: { capturedAt: 'ASC' },
    });
    return {
      interval,
      points: rows.map((r) => ({
        capturedAt: r.capturedAt.toISOString(),
        readinessPct: r.readinessPct,
        totalControls: r.totalControls,
        compliant: r.compliant,
        evidenceCount: r.evidenceCount,
        expiredEvidenceCount: r.expiredEvidenceCount,
        openRiskCount: r.openRiskCount,
      })),
    };
  }

  async getConMonSummary(projectId: string) {
    const stats = await this.getStats(projectId);
    const last = await this.snapshots.findOne({
      where: { projectId },
      order: { capturedAt: 'DESC' },
    });
    return {
      current: stats,
      lastSnapshot: last
        ? {
            capturedAt: last.capturedAt.toISOString(),
            readinessPct: last.readinessPct,
            evidenceCount: last.evidenceCount,
            expiredEvidenceCount: last.expiredEvidenceCount,
          }
        : null,
    };
  }

  async getEvidenceFreshness(projectId: string) {
    const now = new Date();
    const items = await this.evidenceRepo
      .createQueryBuilder('e')
      .innerJoinAndSelect('e.checklistItem', 'ci')
      .where('ci.projectId = :projectId', { projectId })
      .orderBy('e.createdAt', 'DESC')
      .take(500)
      .getMany();
    const heatmap = items.map((e) => {
      let level: 'green' | 'yellow' | 'red' = 'green';
      if (e.expiresAt) {
        const exp = new Date(e.expiresAt).getTime();
        if (exp < now.getTime()) level = 'red';
        else if (exp < now.getTime() + 14 * 86400000) level = 'yellow';
      }
      return { evidenceId: e.id, checklistItemId: e.checklistItemId, level };
    });
    return { items: heatmap };
  }

  /** Called by cron to persist daily posture per project. */
  async captureSnapshotForProject(projectId: string) {
    const stats = await this.getStats(projectId);
    const evCount = await this.evidenceRepo
      .createQueryBuilder('e')
      .innerJoin('e.checklistItem', 'ci')
      .where('ci.projectId = :projectId', { projectId })
      .getCount();
    const expired = await this.evidenceRepo
      .createQueryBuilder('e')
      .innerJoin('e.checklistItem', 'ci')
      .where('ci.projectId = :projectId', { projectId })
      .andWhere('e.expiresAt IS NOT NULL')
      .andWhere('e.expiresAt < :now', { now: new Date() })
      .getCount();
    const openRisks = await this.riskRepo.count({
      where: { projectId, status: 'open' },
    });
    const row = this.snapshots.create({
      projectId,
      capturedAt: new Date(),
      totalControls: stats.totalControls,
      compliant: stats.compliant,
      inProgress: stats.inProgress,
      nonCompliant: stats.nonCompliant,
      readinessPct: stats.readinessPct,
      evidenceCount: evCount,
      expiredEvidenceCount: expired,
      openRiskCount: openRisks,
    });
    await this.snapshots.save(row);
    return row;
  }
}
