import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { FrrRequirement } from '../entities/frr-requirement.entity';
import { KsiIndicator } from '../entities/ksi-indicator.entity';
import { ChecklistItem } from '../entities/checklist-item.entity';
import { EvidenceItem } from '../entities/evidence-item.entity';
import { FrmrVersion } from '../entities/frmr-version.entity';
import { FrmrCatalogSyncService } from '../catalog/frmr-catalog-sync.service';
import type { PaginatedResult } from '../common/pagination/paginated-result';
import { toPaginated } from '../common/pagination/paginated-result';
import { parseSortParam } from '../common/sort/parse-sort';

@Injectable()
export class ChecklistService {
  constructor(
    @InjectRepository(Project) private readonly projRepo: Repository<Project>,
    @InjectRepository(FrrRequirement)
    private readonly frrRepo: Repository<FrrRequirement>,
    @InjectRepository(KsiIndicator)
    private readonly ksiRepo: Repository<KsiIndicator>,
    @InjectRepository(ChecklistItem)
    private readonly itemRepo: Repository<ChecklistItem>,
    @InjectRepository(EvidenceItem)
    private readonly evidenceRepo: Repository<EvidenceItem>,
    @InjectRepository(FrmrVersion)
    private readonly verRepo: Repository<FrmrVersion>,
    private readonly frmrCatalogSync: FrmrCatalogSyncService,
  ) {}

  parseActors(s: string): string[] {
    return s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  }

  async generateChecklist(projectId: string, includeKsi = true): Promise<number> {
    const project = await this.projRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const ver = project.frmrVersionId
      ? await this.verRepo.findOne({ where: { id: project.frmrVersionId } })
      : await this.verRepo.find({
          order: { ingestedAt: 'DESC' },
          take: 1,
        }).then((rows) => rows[0] ?? null);
    if (!ver) throw new NotFoundException('No FRMR version ingested');

    let release = await this.frmrCatalogSync.getReleaseForFrmrVersion(ver.id);
    if (!release) {
      await this.frmrCatalogSync.syncFromFrmrVersion(ver.id);
      release = await this.frmrCatalogSync.getReleaseForFrmrVersion(ver.id);
    }

    const versionId = ver.id;
    const actors = this.parseActors(project.actorLabels);
    const layers =
      project.pathType === '20x' ? (['both', '20x'] as const) : (['both', 'rev5'] as const);

    const qb = this.frrRepo
      .createQueryBuilder('r')
      .where('r.version_id = :versionId', { versionId })
      .andWhere('r.layer IN (:...layers)', { layers })
      .andWhere('r.actor_label IN (:...actors)', { actors })
      .andWhere(
        new Brackets((q) => {
          q.where('r.impact_level IS NULL').orWhere(
            'r.impact_level = :impact',
            { impact: project.impactLevel },
          );
        }),
      );

    const reqs = await qb.getMany();
    let created = 0;
    for (const r of reqs) {
      const exists = await this.itemRepo.findOne({
        where: { projectId, frrRequirementId: r.id },
      });
      if (exists) continue;
      let due: Date | null = null;
      if (r.timeframeType && r.timeframeNum && project.complianceStartDate) {
        const start = new Date(project.complianceStartDate);
        due = new Date(start);
        if (r.timeframeType === 'days')
          due.setDate(due.getDate() + r.timeframeNum);
        else if (r.timeframeType === 'months')
          due.setMonth(due.getMonth() + r.timeframeNum);
      }
      const catalogReq =
        release &&
        (await this.frmrCatalogSync.findCatalogRequirementForFrr(release.id, r.id));
      await this.itemRepo.save(
        this.itemRepo.create({
          projectId,
          frrRequirementId: r.id,
          catalogRequirementId: catalogReq?.id ?? null,
          status: 'not_started',
          ...(due ? { dueDate: due } : {}),
        }),
      );
      created++;
    }

    if (includeKsi && project.pathType === '20x') {
      const ksis = await this.ksiRepo.find({ where: { versionId } });
      for (const k of ksis) {
        const exists = await this.itemRepo.findOne({
          where: { projectId, ksiIndicatorId: k.id },
        });
        if (exists) continue;
        const catalogReq =
          release &&
          (await this.frmrCatalogSync.findCatalogRequirementForKsi(release.id, k.id));
        await this.itemRepo.save(
          this.itemRepo.create({
            projectId,
            ksiIndicatorId: k.id,
            catalogRequirementId: catalogReq?.id ?? null,
            status: 'not_started',
          }),
        );
        created++;
      }
    }

    return created;
  }

  /** Paginated checklist rows with catalog/FRR/KSI joins (no evidence graph). */
  async listChecklistPaginated(
    projectId: string,
    page: number,
    limit: number,
    sort?: string,
  ): Promise<PaginatedResult<ChecklistItem>> {
    const total = await this.itemRepo.count({ where: { projectId } });
    const skip = (page - 1) * limit;
    const allowed = {
      id: 'ci.id',
      status: 'ci.status',
      dueDate: 'ci.due_date',
      reviewState: 'ci.review_state',
    };
    const { column, order } = parseSortParam(sort, allowed, 'id');

    const items = await this.itemRepo
      .createQueryBuilder('ci')
      .leftJoinAndSelect('ci.frrRequirement', 'frr')
      .leftJoinAndSelect('ci.ksiIndicator', 'ksi')
      .leftJoinAndSelect('ci.ownerUser', 'owner')
      .leftJoinAndSelect('ci.catalogRequirement', 'cr')
      .leftJoinAndSelect('cr.frameworkRelease', 'fr_rel')
      .leftJoinAndSelect('fr_rel.framework', 'fw')
      .where('ci.projectId = :projectId', { projectId })
      .orderBy(column, order)
      .skip(skip)
      .take(limit)
      .getMany();

    return toPaginated(items, page, limit, total);
  }

  /**
   * Evidence gap report: summary counts, automated/stale metrics, and a paginated list of
   * controls with no evidence. Does not load full checklist+evidence graphs.
   */
  async getEvidenceGapsReport(
    projectId: string,
    page: number,
    limit: number,
    staleDays = 30,
  ) {
    const totalControls = await this.itemRepo.count({ where: { projectId } });

    const missingEvidenceCount = await this.itemRepo
      .createQueryBuilder('ci')
      .where('ci.projectId = :projectId', { projectId })
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM evidence_items e WHERE e.checklist_item_id = ci.id)`,
      )
      .getCount();

    const automatedEvidence = await this.computeAutomatedEvidenceStats(
      projectId,
      staleDays,
    );

    const skip = (page - 1) * limit;
    const rows = await this.itemRepo
      .createQueryBuilder('ci')
      .leftJoinAndSelect('ci.frrRequirement', 'frr')
      .leftJoinAndSelect('ci.ksiIndicator', 'ksi')
      .leftJoinAndSelect('ci.catalogRequirement', 'cr')
      .leftJoinAndSelect('cr.frameworkRelease', 'fr_rel')
      .leftJoinAndSelect('fr_rel.framework', 'fw')
      .where('ci.projectId = :projectId', { projectId })
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM evidence_items e WHERE e.checklist_item_id = ci.id)`,
      )
      .orderBy('ci.id', 'ASC')
      .skip(skip)
      .take(limit)
      .getMany();

    const items = rows.map((i) => ({
      id: i.id,
      status: i.status,
      ref: i.frrRequirement
        ? `${i.frrRequirement.processId} ${i.frrRequirement.reqKey}`
        : i.ksiIndicator?.indicatorId || i.id,
      catalogRequirementCode: i.catalogRequirement?.requirementCode ?? null,
      frameworkCode: i.catalogRequirement?.frameworkRelease?.framework?.code ?? null,
    }));

    const pageResult = toPaginated(items, page, limit, missingEvidenceCount);

    return {
      projectId,
      totalControls,
      missingEvidenceCount,
      automatedEvidence,
      items: pageResult.items,
      page: pageResult.page,
      limit: pageResult.limit,
      total: pageResult.total,
      hasMore: pageResult.hasMore,
    };
  }

  private async computeAutomatedEvidenceStats(projectId: string, staleDays: number) {
    const staleMs = staleDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const evs = await this.evidenceRepo.find({
      where: { checklistItem: { projectId } },
      select: {
        id: true,
        checklistItemId: true,
        metadata: true,
        createdAt: true,
      },
    });

    const byCid = new Map<string, EvidenceItem[]>();
    for (const e of evs) {
      const arr = byCid.get(e.checklistItemId) ?? [];
      arr.push(e);
      byCid.set(e.checklistItemId, arr);
    }

    let controlsWithOnlyAutomated = 0;
    let controlsWithStaleAutomated = 0;
    for (const ev of byCid.values()) {
      if (ev.length === 0) continue;
      const auto = ev.filter(
        (x) =>
          x.metadata && (x.metadata as { automated?: boolean }).automated === true,
      );
      if (auto.length === ev.length) controlsWithOnlyAutomated += 1;
      const stale = auto.some((x) => {
        const created = x.createdAt ? new Date(x.createdAt).getTime() : 0;
        return created && now - created > staleMs;
      });
      if (stale) controlsWithStaleAutomated += 1;
    }

    return {
      controlsWithOnlyAutomated,
      controlsWithStaleAutomated,
      staleAfterDays: staleDays,
    };
  }

  /** Attach catalog_requirement_id to existing rows that only have FRR/KSI links. */
  async backfillCatalogRequirementLinks(projectId: string): Promise<number> {
    const project = await this.projRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    const ver = project.frmrVersionId
      ? await this.verRepo.findOne({ where: { id: project.frmrVersionId } })
      : await this.verRepo.find({
          order: { ingestedAt: 'DESC' },
          take: 1,
        }).then((rows) => rows[0] ?? null);
    if (!ver) return 0;
    let release = await this.frmrCatalogSync.getReleaseForFrmrVersion(ver.id);
    if (!release) {
      await this.frmrCatalogSync.syncFromFrmrVersion(ver.id);
      release = await this.frmrCatalogSync.getReleaseForFrmrVersion(ver.id);
    }
    if (!release) return 0;

    const items = await this.itemRepo.find({ where: { projectId } });
    let updated = 0;
    for (const it of items) {
      if (it.catalogRequirementId) continue;
      if (it.frrRequirementId) {
        const cr = await this.frmrCatalogSync.findCatalogRequirementForFrr(
          release.id,
          it.frrRequirementId,
        );
        if (cr) {
          it.catalogRequirementId = cr.id;
          updated++;
        }
      } else if (it.ksiIndicatorId) {
        const cr = await this.frmrCatalogSync.findCatalogRequirementForKsi(
          release.id,
          it.ksiIndicatorId,
        );
        if (cr) {
          it.catalogRequirementId = cr.id;
          updated++;
        }
      }
    }
    if (updated) await this.itemRepo.save(items);
    return updated;
  }

  async applySuggestedDueDates(
    projectId: string,
    anchorDate?: Date,
  ): Promise<number> {
    const project = await this.projRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    const items = await this.itemRepo.find({
      where: { projectId },
      relations: ['frrRequirement', 'ksiIndicator'],
      order: { id: 'ASC' },
    });
    if (!items.length) return 0;

    const start =
      anchorDate ||
      (project.complianceStartDate ? new Date(project.complianceStartDate) : new Date());
    start.setHours(0, 0, 0, 0);

    const perPriorityCount: Record<'critical' | 'high' | 'medium' | 'low', number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    let updated = 0;
    for (const item of items) {
      if (item.dueDate) continue;

      const priority = this.classifyPriority(item);
      const baseDays = this.suggestedDaysByImpact(project.impactLevel, priority);
      const wave = Math.floor(perPriorityCount[priority] / 30) * 14;
      perPriorityCount[priority]++;
      const due = new Date(start);
      due.setDate(due.getDate() + baseDays + wave);
      item.dueDate = due;
      updated++;
    }

    if (updated > 0) {
      await this.itemRepo.save(items);
    }
    return updated;
  }

  private classifyPriority(
    item: ChecklistItem,
  ): 'critical' | 'high' | 'medium' | 'low' {
    const reqText = item.frrRequirement?.statement || '';
    const keyword = item.frrRequirement?.primaryKeyWord || '';
    const controls = (item.ksiIndicator?.controls || []).join(' ');
    const basis = `${reqText} ${keyword} ${controls}`.toLowerCase();

    const criticalHints = [
      'incident',
      'breach',
      'vulnerability',
      'patch',
      'encryption',
      'key management',
      'boundary',
      'access control',
      'authentication',
      'identity',
      'privileged',
    ];
    const highHints = [
      'audit',
      'logging',
      'monitor',
      'configuration',
      'network',
      'backup',
      'contingency',
      'recovery',
      'malware',
      'detection',
    ];
    const mediumHints = [
      'policy',
      'procedure',
      'training',
      'awareness',
      'document',
      'inventory',
      'asset',
    ];

    if (criticalHints.some((h) => basis.includes(h))) return 'critical';
    if (highHints.some((h) => basis.includes(h))) return 'high';
    if (mediumHints.some((h) => basis.includes(h))) return 'medium';
    return 'low';
  }

  private suggestedDaysByImpact(
    impact: 'low' | 'moderate' | 'high',
    priority: 'critical' | 'high' | 'medium' | 'low',
  ): number {
    const map: Record<
      'low' | 'moderate' | 'high',
      Record<'critical' | 'high' | 'medium' | 'low', number>
    > = {
      high: { critical: 30, high: 60, medium: 90, low: 120 },
      moderate: { critical: 45, high: 75, medium: 120, low: 150 },
      low: { critical: 60, high: 90, medium: 150, low: 180 },
    };
    return map[impact][priority];
  }
}
