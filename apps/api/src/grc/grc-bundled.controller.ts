import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectsService } from '../projects/projects.service';
import { GrcAudit } from '../entities/grc-audit.entity';
import { AuditFinding } from '../entities/audit-finding.entity';
import {
  AuditFindingSeverity,
  AuditFindingStatus,
} from '../entities/enums/grc-enums';
import { AuditEvidenceRequest } from '../entities/audit-evidence-request.entity';
import { PoamService } from '../poam/poam.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { RiskService } from '../risks/risk.service';
import { Vendor } from '../entities/vendor.entity';
import { VendorAssessment } from '../entities/vendor-assessment.entity';
import { Incident } from '../entities/incident.entity';
import { Asset } from '../entities/asset.entity';
import { PipelineCheck } from '../entities/pipeline-check.entity';

@ApiTags('audits')
@Controller('projects/:projectId/audits')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class ProjectAuditsController {
  constructor(
    @InjectRepository(GrcAudit) private readonly audits: Repository<GrcAudit>,
    @InjectRepository(AuditFinding)
    private readonly findings: Repository<AuditFinding>,
    @InjectRepository(AuditEvidenceRequest)
    private readonly evReq: Repository<AuditEvidenceRequest>,
    private readonly projects: ProjectsService,
    private readonly poam: PoamService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List audits' })
  async list(
    @Param('projectId') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    await this.projects.assertAccess(projectId, req.user.userId, req.user.role);
    return this.audits.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create audit' })
  async create(
    @Param('projectId') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body()
    b: {
      type: 'internal' | 'external' | '3pao';
      scope?: string;
      plannedStart?: string;
      plannedEnd?: string;
    },
  ) {
    await this.projects.assertAccess(projectId, req.user.userId, req.user.role);
    const row = this.audits.create({
      projectId,
      type: b.type,
      status: 'planned',
      leadAuditorUserId: req.user.userId,
      scope: b.scope ?? null,
      plannedStart: b.plannedStart ? new Date(b.plannedStart) : null,
      plannedEnd: b.plannedEnd ? new Date(b.plannedEnd) : null,
    });
    return this.audits.save(row);
  }

  @Get(':auditId')
  async getOne(
    @Param('projectId') projectId: string,
    @Param('auditId') auditId: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    await this.projects.assertAccess(projectId, req.user.userId, req.user.role);
    return this.audits.findOne({ where: { id: auditId, projectId } });
  }

  @Post(':auditId/findings')
  async addFinding(
    @Param('projectId') projectId: string,
    @Param('auditId') auditId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body()
    b: {
      title: string;
      severity: string;
      checklistItemId?: string;
      description?: string;
      remediationPlan?: string;
      dueDate?: string;
    },
  ) {
    await this.projects.assertAccess(projectId, req.user.userId, req.user.role);
    const f = this.findings.create({
      auditId,
      severity: b.severity as AuditFindingSeverity,
      status: AuditFindingStatus.Open,
      checklistItemId: b.checklistItemId ?? null,
      title: b.title,
      description: b.description ?? null,
      remediationPlan: b.remediationPlan ?? null,
      dueDate: b.dueDate ? new Date(b.dueDate) : null,
    });
    const saved = await this.findings.save(f);
    if (b.checklistItemId) {
      await this.poam.syncFromChecklist(projectId).catch(() => undefined);
    }
    return saved;
  }

  @Post(':auditId/evidence-requests')
  async addEvReq(
    @Param('projectId') projectId: string,
    @Param('auditId') auditId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() b: { assigneeUserId?: string; notes?: string },
  ) {
    await this.projects.assertAccess(projectId, req.user.userId, req.user.role);
    return this.evReq.save(
      this.evReq.create({
        auditId,
        assigneeUserId: b.assigneeUserId ?? null,
        status: 'requested',
        notes: b.notes ?? null,
      }),
    );
  }
}

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class ReportsController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly risks: RiskService,
    private readonly projects: ProjectsService,
  ) {}

  @Get('compliance-summary')
  @ApiOperation({ summary: 'Compliance KPI summary' })
  async complianceSummary(
    @Query('projectId') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    await this.projects.assertAccess(projectId, req.user.userId, req.user.role);
    const s = await this.dashboard.getStats(projectId);
    return {
      readinessPct: s.readinessPct,
      totalControls: s.totalControls,
      compliant: s.compliant,
      nonCompliant: s.nonCompliant,
      inProgress: s.inProgress,
    };
  }

  @Get('risk-posture')
  async riskPosture(
    @Query('projectId') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    await this.projects.assertAccess(projectId, req.user.userId, req.user.role);
    const h = await this.risks.heatmap(projectId, req.user.userId, req.user.role);
    return h;
  }

  @Get('executive-briefing')
  async executive(
    @Query('projectId') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    await this.projects.assertAccess(projectId, req.user.userId, req.user.role);
    const s = await this.dashboard.getStats(projectId);
    const h = await this.risks.heatmap(projectId, req.user.userId, req.user.role);
    return {
      summary: `Readiness ${s.readinessPct}% across ${s.totalControls} controls.`,
      stats: s,
      riskHeatmap: h,
    };
  }
}

@ApiTags('vendors')
@Controller('projects/:projectId/vendors')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class VendorsController {
  constructor(
    @InjectRepository(Vendor) private readonly repo: Repository<Vendor>,
    @InjectRepository(VendorAssessment)
    private readonly assessments: Repository<VendorAssessment>,
    private readonly projects: ProjectsService,
  ) {}

  @Get()
  async list(
    @Param('projectId') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    await this.projects.assertAccess(projectId, req.user.userId, req.user.role);
    return this.repo.find({ where: { projectId } });
  }

  @Post()
  async create(
    @Param('projectId') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() b: { name: string; criticality?: string; status?: string },
  ) {
    await this.projects.assertAccess(projectId, req.user.userId, req.user.role);
    return this.repo.save(
      this.repo.create({
        projectId,
        name: b.name,
        criticality: b.criticality ?? null,
        status: b.status || 'active',
      }),
    );
  }

  @Post(':vendorId/assessments')
  async assess(
    @Param('projectId') projectId: string,
    @Param('vendorId') vendorId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() b: { riskScore?: number; questionnaire?: Record<string, unknown>; findings?: string },
  ) {
    await this.projects.assertAccess(projectId, req.user.userId, req.user.role);
    return this.assessments.save(
      this.assessments.create({
        vendorId,
        riskScore: b.riskScore ?? null,
        questionnaire: b.questionnaire ?? null,
        findings: b.findings ?? null,
      }),
    );
  }
}

@ApiTags('incidents')
@Controller('projects/:projectId/incidents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class IncidentsController {
  constructor(
    @InjectRepository(Incident) private readonly repo: Repository<Incident>,
    private readonly projects: ProjectsService,
  ) {}

  @Get()
  async list(
    @Param('projectId') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    await this.projects.assertAccess(projectId, req.user.userId, req.user.role);
    return this.repo.find({ where: { projectId }, order: { createdAt: 'DESC' } });
  }

  @Post()
  async create(
    @Param('projectId') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body()
    b: {
      title: string;
      severity: 'P1' | 'P2' | 'P3' | 'P4';
      status?: string;
      description?: string;
    },
  ) {
    await this.projects.assertAccess(projectId, req.user.userId, req.user.role);
    return this.repo.save(
      this.repo.create({
        projectId,
        title: b.title,
        severity: b.severity,
        status: b.status || 'new',
        description: b.description ?? null,
        ownerUserId: req.user.userId,
      }),
    );
  }
}

@ApiTags('assets')
@Controller('projects/:projectId/assets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class AssetsController {
  constructor(
    @InjectRepository(Asset) private readonly repo: Repository<Asset>,
    private readonly projects: ProjectsService,
  ) {}

  @Get()
  async list(
    @Param('projectId') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    await this.projects.assertAccess(projectId, req.user.userId, req.user.role);
    return this.repo.find({ where: { projectId } });
  }

  @Post()
  async create(
    @Param('projectId') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body()
    b: {
      name: string;
      type?: string;
      environment?: string;
      criticality?: string;
    },
  ) {
    await this.projects.assertAccess(projectId, req.user.userId, req.user.role);
    return this.repo.save(
      this.repo.create({
        projectId,
        name: b.name,
        type: b.type ?? null,
        environment: b.environment ?? null,
        criticality: b.criticality ?? null,
      }),
    );
  }
}

@ApiTags('pipeline')
@Controller('pipeline')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class PipelineController {
  constructor(
    @InjectRepository(PipelineCheck) private readonly repo: Repository<PipelineCheck>,
    private readonly dashboard: DashboardService,
    private readonly projects: ProjectsService,
  ) {}

  @Post('check')
  @ApiOperation({ summary: 'CI gate: pass/fail from readiness threshold' })
  async check(
    @Req() req: { user: { userId: string; role: string } },
    @Body() b: { projectId: string; minReadinessPct?: number },
  ) {
    await this.projects.assertAccess(b.projectId, req.user.userId, req.user.role);
    const s = await this.dashboard.getStats(b.projectId);
    const min = b.minReadinessPct ?? 80;
    const pass = s.readinessPct >= min;
    await this.repo.save(
      this.repo.create({
        projectId: b.projectId,
        status: pass ? 'pass' : 'fail',
        detail: JSON.stringify({ readinessPct: s.readinessPct, min }),
      }),
    );
    return { pass, readinessPct: s.readinessPct, minReadinessPct: min };
  }

  @Get('badge/:projectId')
  async badge(@Param('projectId') projectId: string) {
    const s = await this.dashboard.getStats(projectId);
    const label = `${Math.round(s.readinessPct)}%`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20"><rect width="120" height="20" fill="#555"/><text x="10" y="14" fill="#fff" font-size="11">OpenGRC ${label}</text></svg>`;
    return { svg, readinessPct: s.readinessPct };
  }
}
