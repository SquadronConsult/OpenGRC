import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Risk } from '../entities/risk.entity';
import { RiskChecklistMitigation } from '../entities/risk-checklist-mitigation.entity';
import { RiskInternalControlMitigation } from '../entities/risk-internal-control-mitigation.entity';
import { RiskAcceptanceRequest } from '../entities/risk-acceptance-request.entity';
import { RiskAcceptanceStep } from '../entities/risk-acceptance-step.entity';
import { ChecklistItem } from '../entities/checklist-item.entity';
import { InternalControl } from '../entities/internal-control.entity';
import { User } from '../entities/user.entity';
import { ProjectsService } from '../projects/projects.service';
import {
  clampLhi,
  inherentScore,
  residualNeedsOverride,
  riskBand,
} from './risk-scoring';
import {
  RiskAcceptanceRequestStatus,
  RiskStatus,
} from '../entities/enums/grc-enums';

@Injectable()
export class RiskService {
  constructor(
    @InjectRepository(Risk) private readonly risks: Repository<Risk>,
    @InjectRepository(RiskChecklistMitigation)
    private readonly rcm: Repository<RiskChecklistMitigation>,
    @InjectRepository(RiskInternalControlMitigation)
    private readonly ricm: Repository<RiskInternalControlMitigation>,
    @InjectRepository(RiskAcceptanceRequest)
    private readonly rar: Repository<RiskAcceptanceRequest>,
    @InjectRepository(RiskAcceptanceStep)
    private readonly ras: Repository<RiskAcceptanceStep>,
    @InjectRepository(ChecklistItem) private readonly items: Repository<ChecklistItem>,
    @InjectRepository(InternalControl) private readonly ic: Repository<InternalControl>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly projects: ProjectsService,
  ) {}

  async list(projectId: string, userId: string, role: string) {
    await this.projects.assertAccess(projectId, userId, role);
    const rows = await this.risks.find({
      where: { projectId },
      order: { updatedAt: 'DESC' },
      relations: ['owner'],
    });
    return rows.map((r) => this.toDto(r));
  }

  async listPaginated(
    projectId: string,
    userId: string,
    role: string,
    paging: { skip: number; take: number; page: number; limit: number },
    sort: { column: string; order: 'ASC' | 'DESC' },
  ) {
    await this.projects.assertAccess(projectId, userId, role);
    const qb = this.risks
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.owner', 'owner')
      .where('r.projectId = :projectId', { projectId });
    const total = await qb.getCount();
    const rows = await qb
      .clone()
      .orderBy(sort.column, sort.order)
      .skip(paging.skip)
      .take(paging.take)
      .getMany();
    const items = rows.map((x) => this.toDto(x));
    return {
      items,
      page: paging.page,
      limit: paging.limit,
      total,
      hasMore: paging.page * paging.limit < total,
    };
  }

  async heatmap(projectId: string, userId: string, role: string) {
    await this.projects.assertAccess(projectId, userId, role);
    const rows = await this.risks.find({ where: { projectId } });
    const cells: Record<string, number> = {};
    for (let l = 1; l <= 5; l++) {
      for (let i = 1; i <= 5; i++) {
        cells[`${l}x${i}`] = 0;
      }
    }
    for (const r of rows) {
      const key = `${r.likelihood}x${r.impact}`;
      cells[key] = (cells[key] ?? 0) + 1;
    }
    return { projectId, cells, total: rows.length };
  }

  async create(
    projectId: string,
    userId: string,
    role: string,
    dto: {
      title: string;
      description?: string;
      category?: string;
      likelihood: number;
      impact: number;
      residualLikelihood?: number | null;
      residualImpact?: number | null;
      residualOverrideReason?: string | null;
      status?: string;
      ownerUserId?: string | null;
      appetiteDecision?: string | null;
      acceptanceExpiresAt?: string | null;
    },
  ) {
    await this.projects.assertAccess(projectId, userId, role);
    const l = clampLhi(dto.likelihood);
    const im = clampLhi(dto.impact);
    const inh = inherentScore(l, im);
    const { residualScore, overrideReason } = this.computeResidual(
      inh,
      l,
      im,
      dto.residualLikelihood,
      dto.residualImpact,
      dto.residualOverrideReason ?? null,
    );
    const row = this.risks.create({
      id: randomUUID(),
      projectId,
      title: dto.title,
      description: dto.description ?? null,
      category: dto.category ?? null,
      likelihood: l,
      impact: im,
      inherentScore: inh,
      residualLikelihood: dto.residualLikelihood != null ? clampLhi(dto.residualLikelihood) : null,
      residualImpact: dto.residualImpact != null ? clampLhi(dto.residualImpact) : null,
      residualScore,
      residualOverrideReason: overrideReason,
      status: (dto.status as RiskStatus | undefined) ?? RiskStatus.Open,
      ownerUserId: dto.ownerUserId ?? userId,
      appetiteDecision: dto.appetiteDecision ?? null,
      acceptanceExpiresAt: dto.acceptanceExpiresAt
        ? new Date(dto.acceptanceExpiresAt)
        : null,
    });
    await this.risks.save(row);
    return this.getById(projectId, row.id, userId, role);
  }

  async patch(
    projectId: string,
    riskId: string,
    userId: string,
    role: string,
    dto: Partial<{
      title: string;
      description: string | null;
      category: string | null;
      likelihood: number;
      impact: number;
      residualLikelihood: number | null;
      residualImpact: number | null;
      residualOverrideReason: string | null;
      status: string;
      ownerUserId: string | null;
      appetiteDecision: string | null;
      acceptanceExpiresAt: string | null;
    }>,
  ) {
    const r = await this.requireRisk(projectId, riskId, userId, role);
    if (dto.title !== undefined) r.title = dto.title;
    if (dto.description !== undefined) r.description = dto.description;
    if (dto.category !== undefined) r.category = dto.category;
    if (dto.likelihood !== undefined) r.likelihood = clampLhi(dto.likelihood);
    if (dto.impact !== undefined) r.impact = clampLhi(dto.impact);
    if (dto.residualLikelihood !== undefined) {
      r.residualLikelihood =
        dto.residualLikelihood === null ? null : clampLhi(dto.residualLikelihood);
    }
    if (dto.residualImpact !== undefined) {
      r.residualImpact =
        dto.residualImpact === null ? null : clampLhi(dto.residualImpact);
    }
    if (dto.status !== undefined) r.status = dto.status as RiskStatus;
    if (dto.ownerUserId !== undefined) r.ownerUserId = dto.ownerUserId;
    if (dto.appetiteDecision !== undefined) r.appetiteDecision = dto.appetiteDecision;
    if (dto.acceptanceExpiresAt !== undefined) {
      r.acceptanceExpiresAt = dto.acceptanceExpiresAt
        ? new Date(dto.acceptanceExpiresAt)
        : null;
    }
    r.inherentScore = inherentScore(r.likelihood, r.impact);
    const overrideIn =
      dto.residualOverrideReason !== undefined
        ? dto.residualOverrideReason
        : r.residualOverrideReason;
    const { residualScore, overrideReason } = this.computeResidual(
      r.inherentScore,
      r.likelihood,
      r.impact,
      r.residualLikelihood,
      r.residualImpact,
      overrideIn,
    );
    r.residualScore = residualScore;
    r.residualOverrideReason = overrideReason;
    await this.risks.save(r);
    return this.getById(projectId, riskId, userId, role);
  }

  async getById(
    projectId: string,
    riskId: string,
    userId: string,
    role: string,
  ) {
    await this.projects.assertAccess(projectId, userId, role);
    const r = await this.risks.findOne({
      where: { id: riskId, projectId },
      relations: ['owner'],
    });
    if (!r) throw new NotFoundException('Risk not found');
    const checklistLinks = await this.rcm.find({
      where: { riskId },
      relations: ['checklistItem'],
    });
    const icLinks = await this.ricm.find({
      where: { riskId },
      relations: ['internalControl'],
    });
    const requests = await this.rar.find({
      where: { riskId },
      order: { createdAt: 'DESC' },
      take: 5,
      relations: ['steps', 'steps.approver', 'submittedBy'],
    });
    return {
      ...this.toDto(r),
      checklistMitigations: checklistLinks.map((m) => ({
        id: m.id,
        checklistItemId: m.checklistItemId,
        notes: m.notes,
        checklistItem: m.checklistItem
          ? {
              id: m.checklistItem.id,
              status: m.checklistItem.status,
            }
          : null,
      })),
      internalControlMitigations: icLinks.map((m) => ({
        id: m.id,
        internalControlId: m.internalControlId,
        notes: m.notes,
        internalControl: m.internalControl
          ? { id: m.internalControl.id, code: m.internalControl.code, title: m.internalControl.title }
          : null,
      })),
      acceptanceRequests: requests.map((req) => ({
        id: req.id,
        status: req.status,
        submittedAt: req.submittedAt,
        submittedById: req.submittedById,
        notes: req.notes,
        steps: (req.steps || [])
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((s) => ({
            id: s.id,
            orderIndex: s.orderIndex,
            approverUserId: s.approverUserId,
            status: s.status,
            notes: s.notes,
            actedAt: s.actedAt,
          })),
      })),
    };
  }

  async addChecklistMitigation(
    projectId: string,
    riskId: string,
    userId: string,
    role: string,
    body: { checklistItemId: string; notes?: string },
  ) {
    await this.requireRisk(projectId, riskId, userId, role);
    const item = await this.items.findOne({
      where: { id: body.checklistItemId, projectId },
    });
    if (!item) {
      throw new NotFoundException('Checklist item not found for this project');
    }
    const existing = await this.rcm.findOne({
      where: { riskId, checklistItemId: body.checklistItemId },
    });
    if (existing) return existing;
    const m = this.rcm.create({
      id: randomUUID(),
      riskId,
      checklistItemId: body.checklistItemId,
      notes: body.notes ?? null,
    });
    await this.rcm.save(m);
    return m;
  }

  async addInternalControlMitigation(
    projectId: string,
    riskId: string,
    userId: string,
    role: string,
    body: { internalControlId: string; notes?: string },
  ) {
    await this.requireRisk(projectId, riskId, userId, role);
    const ctrl = await this.ic.findOne({
      where: { id: body.internalControlId },
    });
    if (!ctrl) throw new NotFoundException('Internal control not found');
    const existing = await this.ricm.findOne({
      where: { riskId, internalControlId: body.internalControlId },
    });
    if (existing) return existing;
    const m = this.ricm.create({
      id: randomUUID(),
      riskId,
      internalControlId: body.internalControlId,
      notes: body.notes ?? null,
    });
    await this.ricm.save(m);
    return m;
  }

  async removeChecklistMitigation(
    projectId: string,
    riskId: string,
    linkId: string,
    userId: string,
    role: string,
  ) {
    await this.requireRisk(projectId, riskId, userId, role);
    const m = await this.rcm.findOne({ where: { id: linkId, riskId } });
    if (!m) throw new NotFoundException('Mitigation link not found');
    await this.rcm.remove(m);
    return { ok: true };
  }

  async removeInternalControlMitigation(
    projectId: string,
    riskId: string,
    linkId: string,
    userId: string,
    role: string,
  ) {
    await this.requireRisk(projectId, riskId, userId, role);
    const m = await this.ricm.findOne({ where: { id: linkId, riskId } });
    if (!m) throw new NotFoundException('Mitigation link not found');
    await this.ricm.remove(m);
    return { ok: true };
  }

  /**
   * Creates a draft request with two steps (reviewer + final approver).
   * Defaults both approvers to project owner when not specified.
   */
  async submitAcceptance(
    projectId: string,
    riskId: string,
    userId: string,
    role: string,
    body: {
      notes?: string;
      reviewerUserId?: string;
      finalApproverUserId?: string;
    },
  ) {
    const risk = await this.requireRisk(projectId, riskId, userId, role);
    const proj = await this.projects.get(projectId, userId, role);
    const ownerId = proj.ownerId;
    const reviewer = body.reviewerUserId || ownerId || userId;
    const finalApprover = body.finalApproverUserId || ownerId || userId;
    for (const uid of [reviewer, finalApprover]) {
      const u = await this.users.findOne({ where: { id: uid } });
      if (!u) throw new BadRequestException(`Invalid approver user id: ${uid}`);
    }
    const pending = await this.rar.findOne({
      where: { riskId, status: RiskAcceptanceRequestStatus.Submitted },
    });
    if (pending) {
      throw new BadRequestException(
        'An acceptance request is already in progress for this risk',
      );
    }
    const req = this.rar.create({
      id: randomUUID(),
      riskId,
      projectId,
      status: RiskAcceptanceRequestStatus.Submitted,
      submittedById: userId,
      submittedAt: new Date(),
      notes: body.notes ?? null,
    });
    await this.rar.save(req);
    const s1 = this.ras.create({
      id: randomUUID(),
      requestId: req.id,
      orderIndex: 0,
      approverUserId: reviewer,
      status: 'pending',
    });
    const s2 = this.ras.create({
      id: randomUUID(),
      requestId: req.id,
      orderIndex: 1,
      approverUserId: finalApprover,
      status: 'pending',
    });
    await this.ras.save([s1, s2]);
    risk.status = RiskStatus.Treating;
    await this.risks.save(risk);
    return this.getById(projectId, riskId, userId, role);
  }

  async approveStep(
    projectId: string,
    riskId: string,
    stepId: string,
    userId: string,
    role: string,
    body: { notes?: string },
  ) {
    const risk = await this.requireRisk(projectId, riskId, userId, role);
    const step = await this.ras.findOne({
      where: { id: stepId },
      relations: ['request'],
    });
    if (!step || step.request.riskId !== riskId) {
      throw new NotFoundException('Step not found');
    }
    if (step.approverUserId !== userId && role !== 'admin') {
      throw new BadRequestException('Not the assigned approver for this step');
    }
    if (step.status !== 'pending') {
      throw new BadRequestException('Step already completed');
    }
    const steps = await this.ras.find({
      where: { requestId: step.requestId },
      order: { orderIndex: 'ASC' },
    });
    const firstPending = steps.find((s) => s.status === 'pending');
    if (!firstPending || firstPending.id !== step.id) {
      throw new BadRequestException('Complete earlier approval steps first');
    }
    step.status = 'approved';
    step.notes = body.notes ?? null;
    step.actedAt = new Date();
    await this.ras.save(step);
    const stillPending = await this.ras.count({
      where: { requestId: step.requestId, status: 'pending' },
    });
    if (stillPending === 0) {
      await this.rar.update(
        { id: step.requestId },
        { status: RiskAcceptanceRequestStatus.Approved },
      );
      risk.status = RiskStatus.Accepted;
      await this.risks.save(risk);
    }
    return this.getById(projectId, riskId, userId, role);
  }

  async rejectStep(
    projectId: string,
    riskId: string,
    stepId: string,
    userId: string,
    role: string,
    body: { notes?: string },
  ) {
    const risk = await this.requireRisk(projectId, riskId, userId, role);
    const step = await this.ras.findOne({
      where: { id: stepId },
      relations: ['request'],
    });
    if (!step || step.request.riskId !== riskId) {
      throw new NotFoundException('Step not found');
    }
    if (step.approverUserId !== userId && role !== 'admin') {
      throw new BadRequestException('Not the assigned approver for this step');
    }
    if (step.status !== 'pending') {
      throw new BadRequestException('Step already completed');
    }
    const steps = await this.ras.find({
      where: { requestId: step.requestId },
      order: { orderIndex: 'ASC' },
    });
    const firstPending = steps.find((s) => s.status === 'pending');
    if (!firstPending || firstPending.id !== step.id) {
      throw new BadRequestException('Complete earlier approval steps first');
    }
    step.status = 'rejected';
    step.notes = body.notes ?? null;
    step.actedAt = new Date();
    await this.ras.save(step);
    await this.rar.update(
      { id: step.requestId },
      { status: RiskAcceptanceRequestStatus.Rejected },
    );
    risk.status = RiskStatus.Open;
    await this.risks.save(risk);
    return this.getById(projectId, riskId, userId, role);
  }

  private async requireRisk(
    projectId: string,
    riskId: string,
    userId: string,
    role: string,
  ) {
    await this.projects.assertAccess(projectId, userId, role);
    const r = await this.risks.findOne({ where: { id: riskId, projectId } });
    if (!r) throw new NotFoundException('Risk not found');
    return r;
  }

  private computeResidual(
    inherent: number,
    likelihood: number,
    impact: number,
    residualLikelihood: number | null | undefined,
    residualImpact: number | null | undefined,
    overrideReason: string | null,
  ): { residualScore: number | null; overrideReason: string | null } {
    if (residualLikelihood == null || residualImpact == null) {
      return { residualScore: null, overrideReason: null };
    }
    const rl = clampLhi(residualLikelihood);
    const ri = clampLhi(residualImpact);
    const rs = rl * ri;
    if (residualNeedsOverride(inherent, rs)) {
      if (!overrideReason || !String(overrideReason).trim()) {
        throw new BadRequestException(
          'residualOverrideReason is required when residual score exceeds inherent score',
        );
      }
      return { residualScore: rs, overrideReason: String(overrideReason).trim() };
    }
    return { residualScore: rs, overrideReason: null };
  }

  private toDto(r: Risk) {
    const inh = r.inherentScore;
    const res = r.residualScore;
    return {
      id: r.id,
      projectId: r.projectId,
      title: r.title,
      description: r.description,
      category: r.category,
      likelihood: r.likelihood,
      impact: r.impact,
      inherentScore: inh,
      inherentBand: riskBand(inh),
      residualLikelihood: r.residualLikelihood,
      residualImpact: r.residualImpact,
      residualScore: res,
      residualBand: res != null ? riskBand(res) : null,
      residualOverrideReason: r.residualOverrideReason,
      status: r.status,
      ownerUserId: r.ownerUserId,
      appetiteDecision: r.appetiteDecision,
      acceptanceExpiresAt: r.acceptanceExpiresAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      owner: r.owner
        ? { id: r.owner.id, email: r.owner.email }
        : null,
    };
  }
}
