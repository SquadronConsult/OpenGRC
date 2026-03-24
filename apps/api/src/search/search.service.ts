import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { ChecklistItem } from '../entities/checklist-item.entity';
import { EvidenceItem } from '../entities/evidence-item.entity';
import { Risk } from '../entities/risk.entity';
import { Policy } from '../entities/policy.entity';
import { ProjectsService } from '../projects/projects.service';

export type SearchResultType = 'checklist' | 'evidence' | 'risk' | 'policy';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(ChecklistItem)
    private readonly checklist: Repository<ChecklistItem>,
    @InjectRepository(EvidenceItem)
    private readonly evidence: Repository<EvidenceItem>,
    @InjectRepository(Risk) private readonly risks: Repository<Risk>,
    @InjectRepository(Policy) private readonly policies: Repository<Policy>,
    private readonly projects: ProjectsService,
  ) {}

  async search(
    userId: string,
    role: string,
    q: string,
    types: SearchResultType[],
    projectId?: string,
    limit = 20,
  ) {
    if (!q || q.trim().length < 2) {
      return { q, items: [] as Record<string, unknown>[] };
    }
    if (projectId)
      await this.projects.assertAccess(projectId, userId, role);
    const term = `%${q.trim().replace(/%/g, '\\%')}%`;
    const take = Math.min(Math.max(limit, 1), 100);
    const items: Record<string, unknown>[] = [];

    const runChecklist = types.includes('checklist');
    const runEvidence = types.includes('evidence');
    const runRisk = types.includes('risk');
    const runPolicy = types.includes('policy');

    if (runChecklist) {
      const qb = this.checklist
        .createQueryBuilder('ci')
        .leftJoinAndSelect('ci.frrRequirement', 'frr')
        .leftJoinAndSelect('ci.catalogRequirement', 'cat')
        .where(
          new Brackets((w) => {
            w.where('frr.statement LIKE :term', { term })
              .orWhere('frr.name LIKE :term', { term })
              .orWhere('cat.statement LIKE :term', { term })
              .orWhere('cat.requirementCode LIKE :term', { term })
              .orWhere('ci.id LIKE :term', { term });
          }),
        )
        .take(take);
      if (projectId) qb.andWhere('ci.projectId = :projectId', { projectId });
      const rows = await qb.getMany();
      for (const ci of rows) {
        items.push({
          type: 'checklist' as const,
          id: ci.id,
          projectId: ci.projectId,
          label:
            ci.catalogRequirement?.requirementCode ||
            ci.frrRequirement?.reqKey ||
            ci.id,
        });
      }
    }

    if (runEvidence) {
      const qb = this.evidence
        .createQueryBuilder('e')
        .leftJoinAndSelect('e.checklistItem', 'ci')
        .where(
          new Brackets((w) => {
            w.where('e.filename LIKE :term', { term })
              .orWhere('e.externalUri LIKE :term', { term })
              .orWhere('e.id LIKE :term', { term });
          }),
        )
        .take(take);
      if (projectId)
        qb.andWhere('ci.projectId = :projectId', { projectId });
      const rows = await qb.getMany();
      for (const e of rows) {
        items.push({
          type: 'evidence' as const,
          id: e.id,
          projectId: e.checklistItem?.projectId,
          checklistItemId: e.checklistItemId,
          label: e.filename || e.externalUri || e.id,
        });
      }
    }

    if (runRisk) {
      const qb = this.risks
        .createQueryBuilder('r')
        .where(
          new Brackets((w) => {
            w.where('r.title LIKE :term', { term }).orWhere(
              'r.description LIKE :term',
              { term },
            );
          }),
        )
        .take(take);
      if (projectId) qb.andWhere('r.projectId = :projectId', { projectId });
      const rows = await qb.getMany();
      for (const r of rows) {
        items.push({
          type: 'risk' as const,
          id: r.id,
          projectId: r.projectId,
          title: r.title,
        });
      }
    }

    if (runPolicy) {
      const qb = this.policies
        .createQueryBuilder('p')
        .where(
          new Brackets((w) => {
            w.where('p.title LIKE :term', { term })
              .orWhere('p.content LIKE :term', { term })
              .orWhere('p.category LIKE :term', { term });
          }),
        )
        .take(take);
      if (projectId)
        qb.andWhere('(p.projectId = :projectId OR p.projectId IS NULL)', {
          projectId,
        });
      const rows = await qb.getMany();
      for (const p of rows) {
        items.push({
          type: 'policy' as const,
          id: p.id,
          projectId: p.projectId,
          title: p.title,
        });
      }
    }

    return { q, items: items.slice(0, take) };
  }
}
