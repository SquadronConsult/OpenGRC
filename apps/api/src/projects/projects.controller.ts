import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ExportService } from '../export/export.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectsService } from './projects.service';
import { ChecklistService } from '../checklist/checklist.service';
import { AuditService } from '../audit/audit.service';
import { PoamService } from '../poam/poam.service';
import { ProjectSnapshotService } from '../project-snapshots/project-snapshot.service';
import { ConnectorInstanceService } from '../connectors/connector-instance.service';
import { DashboardService } from '../dashboard/dashboard.service';
import {
  AddProjectMemberRequestDto,
  CreateProjectRequestDto,
  CreateProjectSnapshotRequestDto,
  GenerateChecklistRequestDto,
} from './dto/project-requests.dto';
import {
  ChecklistListQueryDto,
  EvidenceGapsQueryDto,
  ProjectListQueryDto,
} from './dto/list-query.dto';
import { skipTakeFromPageLimit } from '../common/dto/page-limit-query.dto';
import { parseSortParam } from '../common/sort/parse-sort';

@ApiTags('projects')
@Controller('projects')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly checklistSvc: ChecklistService,
    private readonly audit: AuditService,
    private readonly exportSvc: ExportService,
    private readonly poamSvc: PoamService,
    private readonly snapshots: ProjectSnapshotService,
    private readonly connectors: ConnectorInstanceService,
    private readonly dashboard: DashboardService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List projects for current user (paginated)' })
  list(
    @Req() req: { user: { userId: string; role: string } },
    @Query() q: ProjectListQueryDto,
  ) {
    const { page, limit, skip, take } = skipTakeFromPageLimit(q);
    const sort = parseSortParam(q.sort, {
      createdAt: 'p.created_at',
      name: 'p.name',
      pathType: 'p.path_type',
    }, 'createdAt');
    return this.projects.listForUserPaginated(
      req.user.userId,
      req.user.role,
      { skip, take, page, limit },
      sort,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create project' })
  async create(
    @Req() req: { user: { userId: string } },
    @Body() b: CreateProjectRequestDto,
  ) {
    const p = await this.projects.create(req.user.userId, b);
    let checklistCreated = 0;
    let suggestedDueDates = 0;
    let checklistInitWarning: string | null = null;
    try {
      checklistCreated = await this.checklistSvc.generateChecklist(p.id, true);
      suggestedDueDates = await this.checklistSvc.applySuggestedDueDates(
        p.id,
        b.complianceStartDate ? new Date(b.complianceStartDate) : undefined,
      );
    } catch (e) {
      checklistInitWarning = this.describeChecklistInitFailure(e);
    }
    await this.audit.log(
      req.user.userId,
      'project.create',
      'project',
      p.id,
      { name: p.name, checklistCreated, suggestedDueDates, checklistInitWarning },
    );
    return {
      ...p,
      checklistCreated,
      suggestedDueDates,
      checklistInitWarning,
    };
  }

  @Get(':id/dashboard/trends')
  @ApiOperation({ summary: 'Compliance trends (snapshots)' })
  async dashboardTrends(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('interval') interval?: 'daily' | 'weekly',
  ) {
    await this.projects.assertAccess(id, req.user.userId, req.user.role);
    const f = from || new Date(Date.now() - 90 * 86400000).toISOString();
    const t = to || new Date().toISOString();
    return this.dashboard.getTrends(id, f, t, interval || 'daily');
  }

  @Get(':id/dashboard/conmon')
  @ApiOperation({ summary: 'Continuous monitoring summary' })
  async dashboardConmon(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    await this.projects.assertAccess(id, req.user.userId, req.user.role);
    return this.dashboard.getConMonSummary(id);
  }

  @Get(':id/evidence-freshness')
  @ApiOperation({ summary: 'Evidence freshness heatmap' })
  async evidenceFreshness(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    await this.projects.assertAccess(id, req.user.userId, req.user.role);
    return this.dashboard.getEvidenceFreshness(id);
  }

  @Get(':id/export')
  @ApiOperation({
    summary: 'Export project',
    description:
      'Response content-type varies: JSON (default), `text/markdown` for md/markdown, or OSCAL JSON for oscal-ssp.',
  })
  @ApiProduces('application/json', 'text/markdown; charset=utf-8')
  @ApiQuery({
    name: 'format',
    required: false,
    description: 'json (default), md, markdown, oscal-ssp',
  })
  @ApiOkResponse({
    description: 'JSON bundle, markdown body, or OSCAL SSP JSON',
  })
  async exportProject(
    @Param('id') id: string,
    @Query('format') format: string,
    @Req() req: { user: { userId: string; role: string } },
    @Res() res: Response,
  ) {
    await this.projects.assertAccess(id, req.user.userId, req.user.role);
    const q = format || 'json';
    if (q === 'oscal-ssp') {
      const json = await this.exportSvc.exportOscalSspJson(id);
      return res.json(json);
    }
    if (q === 'oscal-assessment-plan') {
      const json = await this.exportSvc.exportOscalAssessmentPlanJson(id);
      return res.json(json);
    }
    if (q === 'oscal-assessment-results') {
      const json = await this.exportSvc.exportOscalAssessmentResultsJson(id);
      return res.json(json);
    }
    if (q === 'md' || q === 'markdown') {
      const md = await this.exportSvc.exportMarkdown(id);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      return res.send(md);
    }
    const json = await this.exportSvc.exportJson(id);
    return res.json(json);
  }

  @Get(':id/poam')
  @ApiOperation({
    summary: 'Export POA&M',
    description:
      'JSON (default), CSV or markdown with appropriate Content-Type, or OSCAL POA&M JSON.',
  })
  @ApiProduces('application/json', 'text/csv; charset=utf-8', 'text/markdown; charset=utf-8')
  @ApiQuery({
    name: 'format',
    required: false,
    description: 'json (default), csv, md, markdown, oscal-poam',
  })
  @ApiOkResponse({ description: 'POA&M in requested format' })
  async exportPoam(
    @Param('id') id: string,
    @Query('format') format: string,
    @Req() req: { user: { userId: string; role: string } },
    @Res() res: Response,
  ) {
    await this.projects.assertAccess(id, req.user.userId, req.user.role);
    const q = format || 'json';
    if (q === 'oscal-poam') {
      const json = await this.exportSvc.exportOscalPoamJson(id);
      return res.json(json);
    }
    if (q === 'csv') {
      const csv = await this.exportSvc.exportPoamCsv(id);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="poam-${id}.csv"`);
      return res.send(csv);
    }
    if (q === 'md' || q === 'markdown') {
      const md = await this.exportSvc.exportPoamMarkdown(id);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      return res.send(md);
    }
    const json = await this.exportSvc.exportPoamJson(id);
    return res.json(json);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add project member' })
  addMember(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() b: AddProjectMemberRequestDto,
  ) {
    return this.projects.addMember(
      id,
      req.user.userId,
      req.user.role,
      b.email,
      b.role,
    );
  }

  @Post(':id/checklist/generate')
  @ApiOperation({ summary: 'Generate checklist' })
  async genChecklist(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() b: GenerateChecklistRequestDto,
  ) {
    await this.projects.assertAccess(id, req.user.userId, req.user.role);
    const n = await this.checklistSvc.generateChecklist(
      id,
      b.includeKsi !== false,
    );
    return { created: n };
  }

  @Post(':id/checklist/backfill-catalog')
  @ApiOperation({ summary: 'Backfill catalog requirement links' })
  async backfillCatalog(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    await this.projects.assertAccess(id, req.user.userId, req.user.role);
    const updated = await this.checklistSvc.backfillCatalogRequirementLinks(id);
    return { updated };
  }

  @Get(':id/checklist')
  @ApiOperation({ summary: 'Get project checklist (paginated)' })
  async getChecklist(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
    @Query() q: ChecklistListQueryDto,
  ) {
    await this.projects.assertAccess(id, req.user.userId, req.user.role);
    const { page, limit } = skipTakeFromPageLimit(q);
    return this.checklistSvc.listChecklistPaginated(id, page, limit, q.sort);
  }

  /** Controls with no attached evidence (assessor-style gap list). */
  @Get(':id/gaps/evidence')
  @ApiOperation({ summary: 'Evidence gap summary (paginated gap items)' })
  async evidenceGaps(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
    @Query() q: EvidenceGapsQueryDto,
  ) {
    await this.projects.assertAccess(id, req.user.userId, req.user.role);
    const { page, limit } = skipTakeFromPageLimit(q);
    const staleDays = q.staleDays ?? 30;
    const report = await this.checklistSvc.getEvidenceGapsReport(
      id,
      page,
      limit,
      staleDays,
    );
    const connectorStatus = await this.connectors.projectConnectorStatus(
      id,
      req.user.userId,
      req.user.role,
    );
    return {
      ...report,
      connectorSummary: connectorStatus.banner,
    };
  }

  @Post(':id/poam/sync-from-checklist')
  @ApiOperation({ summary: 'Sync POA&M from checklist' })
  async syncPoamFromChecklist(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    await this.projects.assertAccess(id, req.user.userId, req.user.role);
    const r = await this.poamSvc.syncFromChecklist(id);
    await this.audit.log(req.user.userId, 'poam.sync', 'project', id, r);
    return r;
  }

  @Delete(':id/poam/stored')
  @ApiOperation({ summary: 'Clear stored POA&M' })
  async clearStoredPoam(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    await this.projects.assertAccess(id, req.user.userId, req.user.role);
    const r = await this.poamSvc.clearStored(id);
    await this.audit.log(req.user.userId, 'poam.clear_stored', 'project', id, r);
    return r;
  }

  @Post(':id/snapshots')
  @ApiOperation({ summary: 'Create project snapshot' })
  async createSnapshot(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() b: CreateProjectSnapshotRequestDto,
  ) {
    await this.projects.assertAccess(id, req.user.userId, req.user.role);
    const row = await this.snapshots.create(
      id,
      b.title,
      b.kind || 'manual',
      b.payload,
    );
    await this.audit.log(req.user.userId, 'snapshot.create', 'project_snapshot', row.id, {
      projectId: id,
    });
    return row;
  }

  @Get(':id/snapshots')
  @ApiOperation({ summary: 'List project snapshots' })
  async listSnapshots(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    await this.projects.assertAccess(id, req.user.userId, req.user.role);
    return this.snapshots.list(id);
  }

  /** Store an OSCAL SSP JSON fragment for traceability (round-trip foundation). */
  @Post(':id/oscal/import-ssp')
  @ApiOperation({ summary: 'Import OSCAL SSP JSON' })
  @ApiBody({
    description:
      'JSON object containing `system-security-plan`, `ssp`, or a root SSP object.',
    schema: { type: 'object', additionalProperties: true },
  })
  async importOscalSsp(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() body: Record<string, unknown>,
  ) {
    await this.projects.assertAccess(id, req.user.userId, req.user.role);
    const ssp = body['system-security-plan'] || body['ssp'] || body;
    if (!ssp || typeof ssp !== 'object') {
      return { ok: false, message: 'Expected JSON with system-security-plan, ssp, or a root SSP object.' };
    }
    const row = await this.snapshots.create(
      id,
      `OSCAL SSP import ${new Date().toISOString().slice(0, 10)}`,
      'oscal_import',
      { importedAt: new Date().toISOString(), systemSecurityPlan: ssp },
    );
    await this.audit.log(req.user.userId, 'oscal.import_ssp', 'project_snapshot', row.id, {
      projectId: id,
    });
    return { ok: true, snapshotId: row.id };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by id' })
  get(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    return this.projects.get(id, req.user.userId, req.user.role);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete project' })
  async remove(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    const result = await this.projects.remove(id, req.user.userId, req.user.role);
    await this.audit.log(
      req.user.userId,
      'project.delete',
      'project',
      id,
      { deleted: result.deleted },
    );
    return result;
  }

  private describeChecklistInitFailure(e: unknown): string {
    const noFrmrHint =
      'No FRMR data yet. Ingest FRMR or add FRMR_OFFLINE_PATH (or place FRMR.documentation.json under LOCAL_DATA_DIR), then open the project and click Generate checklist.';
    if (e instanceof NotFoundException) {
      const body = e.getResponse();
      let msg = '';
      if (typeof body === 'string') {
        msg = body;
      } else if (body && typeof body === 'object' && 'message' in body) {
        const m = (body as { message: string | string[] }).message;
        msg = Array.isArray(m) ? m.join(' ') : typeof m === 'string' ? m : '';
      }
      if (msg.includes('No FRMR') || msg.includes('FRMR version')) {
        return noFrmrHint;
      }
      return msg || 'Checklist initialization skipped';
    }
    if (e instanceof Error && e.message.includes('No FRMR')) return noFrmrHint;
    if (e instanceof Error && e.message) return e.message;
    return 'Checklist initialization skipped';
  }
}
