import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { FrrRequirement } from '../entities/frr-requirement.entity';
import { KsiIndicator } from '../entities/ksi-indicator.entity';
import { ChecklistItem } from '../entities/checklist-item.entity';
import { FrmrVersion } from '../entities/frmr-version.entity';

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
    @InjectRepository(FrmrVersion)
    private readonly verRepo: Repository<FrmrVersion>,
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
      await this.itemRepo.save(
        this.itemRepo.create({
          projectId,
          frrRequirementId: r.id,
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
        await this.itemRepo.save(
          this.itemRepo.create({
            projectId,
            ksiIndicatorId: k.id,
            status: 'not_started',
          }),
        );
        created++;
      }
    }

    return created;
  }

  async listChecklist(projectId: string) {
    return this.itemRepo.find({
      where: { projectId },
      relations: ['frrRequirement', 'ksiIndicator', 'ownerUser'],
      order: { id: 'ASC' },
    });
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
