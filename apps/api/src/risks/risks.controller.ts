import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditService } from '../audit/audit.service';
import { RiskService } from './risk.service';
import { ProjectsService } from '../projects/projects.service';
import { Risk } from '../entities/risk.entity';
import { RiskListQueryDto } from './dto/risk-list-query.dto';
import { skipTakeFromPageLimit } from '../common/dto/page-limit-query.dto';
import { parseSortParam } from '../common/sort/parse-sort';

@Controller('projects/:id/risks')
@UseGuards(JwtAuthGuard)
export class RisksController {
  constructor(
    private readonly risks: RiskService,
    private readonly audit: AuditService,
    private readonly ds: DataSource,
    private readonly projects: ProjectsService,
  ) {}

  @Get('heatmap')
  @ApiOperation({ summary: 'Risk heatmap' })
  async heatmap(
    @Param('id') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    const h = await this.risks.heatmap(projectId, req.user.userId, req.user.role);
    return h;
  }

  @Get()
  @ApiOperation({ summary: 'List project risks (paginated)' })
  async list(
    @Param('id') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Query() q: RiskListQueryDto,
  ) {
    const paging = skipTakeFromPageLimit(q);
    const sort = parseSortParam(
      q.sort,
      {
        updatedAt: 'r.updated_at',
        createdAt: 'r.created_at',
        title: 'r.title',
        inherentScore: 'r.inherent_score',
        status: 'r.status',
      },
      'updatedAt',
    );
    return this.risks.listPaginated(
      projectId,
      req.user.userId,
      req.user.role,
      paging,
      sort,
    );
  }

  @Patch('bulk')
  @ApiOperation({ summary: 'Bulk update risks' })
  async bulk(
    @Param('id') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body()
    b: {
      ids: string[];
      patch: Partial<{
        status: string;
        ownerUserId: string | null;
      }>;
    },
  ) {
    const updated: Risk[] = [];
    await this.projects.assertAccess(
      projectId,
      req.user.userId,
      req.user.role,
    );
    await this.ds.transaction(async (em) => {
      for (const id of b.ids || []) {
        const row = await em.findOne(Risk, {
          where: { id, projectId },
        });
        if (!row) continue;
        if (b.patch.status != null) row.status = b.patch.status;
        if (b.patch.ownerUserId !== undefined)
          row.ownerUserId = b.patch.ownerUserId;
        await em.save(row);
        updated.push(row);
        await this.audit.log(req.user.userId, 'risk.bulk_update', 'risk', id, {
          projectId,
          patch: b.patch,
        });
      }
    });
    return { updated: updated.length, items: updated };
  }

  @Post()
  @ApiOperation({ summary: 'Create risk' })
  async create(
    @Param('id') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body()
    b: {
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
    const row = await this.risks.create(projectId, req.user.userId, req.user.role, b);
    await this.audit.log(req.user.userId, 'risk.create', 'risk', row.id, {
      projectId,
    });
    return row;
  }

  @Get(':riskId')
  @ApiOperation({ summary: 'Get risk by id' })
  async getOne(
    @Param('id') projectId: string,
    @Param('riskId') riskId: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    return this.risks.getById(projectId, riskId, req.user.userId, req.user.role);
  }

  @Patch(':riskId')
  @ApiOperation({ summary: 'Update risk' })
  async patch(
    @Param('id') projectId: string,
    @Param('riskId') riskId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body()
    b: Partial<{
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
    const row = await this.risks.patch(
      projectId,
      riskId,
      req.user.userId,
      req.user.role,
      b,
    );
    await this.audit.log(req.user.userId, 'risk.update', 'risk', riskId, {
      projectId,
    });
    return row;
  }

  @Post(':riskId/mitigations/checklist-items')
  @ApiOperation({ summary: 'Add checklist mitigation' })
  async addChecklist(
    @Param('id') projectId: string,
    @Param('riskId') riskId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() b: { checklistItemId: string; notes?: string },
  ) {
    const m = await this.risks.addChecklistMitigation(
      projectId,
      riskId,
      req.user.userId,
      req.user.role,
      b,
    );
    await this.audit.log(
      req.user.userId,
      'risk.mitigation.checklist',
      'risk',
      riskId,
      { checklistItemId: b.checklistItemId },
    );
    return m;
  }

  @Post(':riskId/mitigations/internal-controls')
  @ApiOperation({ summary: 'Add internal-control mitigation' })
  async addIc(
    @Param('id') projectId: string,
    @Param('riskId') riskId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() b: { internalControlId: string; notes?: string },
  ) {
    const m = await this.risks.addInternalControlMitigation(
      projectId,
      riskId,
      req.user.userId,
      req.user.role,
      b,
    );
    await this.audit.log(
      req.user.userId,
      'risk.mitigation.internal_control',
      'risk',
      riskId,
      { internalControlId: b.internalControlId },
    );
    return m;
  }

  @Delete(':riskId/mitigations/checklist-items/:linkId')
  @ApiOperation({ summary: 'Remove checklist mitigation' })
  async removeChecklist(
    @Param('id') projectId: string,
    @Param('riskId') riskId: string,
    @Param('linkId') linkId: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    const r = await this.risks.removeChecklistMitigation(
      projectId,
      riskId,
      linkId,
      req.user.userId,
      req.user.role,
    );
    await this.audit.log(req.user.userId, 'risk.mitigation.checklist.remove', 'risk', riskId, {
      linkId,
    });
    return r;
  }

  @Delete(':riskId/mitigations/internal-controls/:linkId')
  async removeIc(
    @Param('id') projectId: string,
    @Param('riskId') riskId: string,
    @Param('linkId') linkId: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    const r = await this.risks.removeInternalControlMitigation(
      projectId,
      riskId,
      linkId,
      req.user.userId,
      req.user.role,
    );
    await this.audit.log(
      req.user.userId,
      'risk.mitigation.internal_control.remove',
      'risk',
      riskId,
      { linkId },
    );
    return r;
  }

  @Post(':riskId/acceptance/submit')
  @ApiOperation({ summary: 'Submit risk acceptance' })
  async submitAcceptance(
    @Param('id') projectId: string,
    @Param('riskId') riskId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body()
    b: { notes?: string; reviewerUserId?: string; finalApproverUserId?: string },
  ) {
    const row = await this.risks.submitAcceptance(
      projectId,
      riskId,
      req.user.userId,
      req.user.role,
      b,
    );
    await this.audit.log(req.user.userId, 'risk.acceptance.submit', 'risk', riskId, {
      projectId,
    });
    return row;
  }

  @Post(':riskId/acceptance/:stepId/approve')
  @ApiOperation({ summary: 'Approve acceptance step' })
  async approve(
    @Param('id') projectId: string,
    @Param('riskId') riskId: string,
    @Param('stepId') stepId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() b: { notes?: string },
  ) {
    const row = await this.risks.approveStep(
      projectId,
      riskId,
      stepId,
      req.user.userId,
      req.user.role,
      b,
    );
    await this.audit.log(req.user.userId, 'risk.acceptance.approve', 'risk', riskId, {
      stepId,
      projectId,
    });
    return row;
  }

  @Post(':riskId/acceptance/:stepId/reject')
  @ApiOperation({ summary: 'Reject acceptance step' })
  async reject(
    @Param('id') projectId: string,
    @Param('riskId') riskId: string,
    @Param('stepId') stepId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() b: { notes?: string },
  ) {
    const row = await this.risks.rejectStep(
      projectId,
      riskId,
      stepId,
      req.user.userId,
      req.user.role,
      b,
    );
    await this.audit.log(req.user.userId, 'risk.acceptance.reject', 'risk', riskId, {
      stepId,
      projectId,
    });
    return row;
  }
}
