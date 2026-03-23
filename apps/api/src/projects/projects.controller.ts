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
import type { Response } from 'express';
import { ExportService } from '../export/export.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectsService } from './projects.service';
import { ChecklistService } from '../checklist/checklist.service';
import { AuditService } from '../audit/audit.service';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly checklistSvc: ChecklistService,
    private readonly audit: AuditService,
    private readonly exportSvc: ExportService,
  ) {}

  @Get()
  list(@Req() req: { user: { userId: string; role: string } }) {
    return this.projects.listForUser(req.user.userId, req.user.role);
  }

  @Post()
  async create(
    @Req() req: { user: { userId: string } },
    @Body()
    b: {
      name: string;
      pathType: '20x' | 'rev5';
      impactLevel: 'low' | 'moderate' | 'high';
      actorLabels?: string;
      complianceStartDate?: string;
    },
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

  @Get(':id/export')
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
    if (q === 'md' || q === 'markdown') {
      const md = await this.exportSvc.exportMarkdown(id);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      return res.send(md);
    }
    const json = await this.exportSvc.exportJson(id);
    return res.json(json);
  }

  @Get(':id/poam')
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

  @Get(':id')
  get(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    return this.projects.get(id, req.user.userId, req.user.role);
  }

  @Post(':id/members')
  addMember(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() b: { email: string; role: string },
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
  async genChecklist(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() b: { includeKsi?: boolean },
  ) {
    await this.projects.assertAccess(id, req.user.userId, req.user.role);
    const n = await this.checklistSvc.generateChecklist(
      id,
      b.includeKsi !== false,
    );
    return { created: n };
  }

  @Get(':id/checklist')
  async getChecklist(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    await this.projects.assertAccess(id, req.user.userId, req.user.role);
    return this.checklistSvc.listChecklist(id);
  }

  @Delete(':id')
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
