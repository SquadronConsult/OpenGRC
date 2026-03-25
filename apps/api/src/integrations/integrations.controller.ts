import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EvidenceItem } from '../entities/evidence-item.entity';
import { ChecklistItem } from '../entities/checklist-item.entity';
import { ExportService } from '../export/export.service';
import { IntegrationEvidenceService } from './integration-evidence.service';
import {
  AutoScopeTriggerRequestDto,
  CiEvidenceIngestDto,
  CreateIntegrationCredentialBodyDto,
  CreateIntegrationCredentialDto,
  CreateIntegrationProjectRequestDto,
  EvidenceBulkIngestRequestDto,
  EvidenceUpsertRequestDto,
  LinkControlRequestDto,
  ResolveControlRequestDto,
  ScannerSummaryIngestDto,
} from './dto/integration-v1.dto';
import { ConnectorInstanceService } from '../connectors/connector-instance.service';
import {
  CreateConnectorInstanceDto,
  UpdateConnectorInstanceDto,
} from '../connectors/dto/connector-instance.dto';
import { AuthService } from '../auth/auth.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { RiskService } from '../risks/risk.service';
import { PolicyService } from '../policies/policy.service';
import { ProjectsService } from '../projects/projects.service';
import { AutoScopeService } from '../auto-scope/auto-scope.service';
import { FindingsService } from '../findings/findings.service';
import { DataSource } from 'typeorm';
import { WebhooksService } from '../webhooks/webhooks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { GrcAudit } from '../entities/grc-audit.entity';
import { Vendor } from '../entities/vendor.entity';
import { Incident } from '../entities/incident.entity';
import { PipelineCheck } from '../entities/pipeline-check.entity';
import { InternalControlMapping } from '../entities/internal-control-mapping.entity';
import { CreatePolicyDto } from '../policies/dto/create-policy.dto';
import { UpdatePolicyDto } from '../policies/dto/update-policy.dto';
import { PatchChecklistItemDto } from '../checklist/dto/patch-checklist-item.dto';
import { BulkChecklistPatchDto } from '../checklist/dto/bulk-checklist.dto';
import { RiskListQueryDto } from '../risks/dto/risk-list-query.dto';
import { AutoScopeRecommendationListQueryDto } from '../auto-scope/dto/recommendation-list-query.dto';
import { FindingListQueryDto } from '../findings/dto/finding-list-query.dto';
import { ChecklistItemStatus } from '../entities/enums/grc-enums';
import { skipTakeFromPageLimit } from '../common/dto/page-limit-query.dto';
import { parseSortParam } from '../common/sort/parse-sort';

@ApiTags('integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly config: ConfigService,
    private readonly integrationEvidence: IntegrationEvidenceService,
    private readonly exportSvc: ExportService,
    private readonly connectorInstances: ConnectorInstanceService,
    private readonly auth: AuthService,
    private readonly dashboard: DashboardService,
    private readonly risks: RiskService,
    private readonly policies: PolicyService,
    private readonly projects: ProjectsService,
    private readonly autoScope: AutoScopeService,
    private readonly findings: FindingsService,
    private readonly ds: DataSource,
    private readonly webhooks: WebhooksService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    @InjectRepository(EvidenceItem) private readonly ev: Repository<EvidenceItem>,
    @InjectRepository(ChecklistItem) private readonly items: Repository<ChecklistItem>,
    @InjectRepository(GrcAudit) private readonly audits: Repository<GrcAudit>,
    @InjectRepository(Vendor) private readonly vendors: Repository<Vendor>,
    @InjectRepository(Incident) private readonly incidents: Repository<Incident>,
    @InjectRepository(PipelineCheck)
    private readonly pipelineChecks: Repository<PipelineCheck>,
    @InjectRepository(InternalControlMapping)
    private readonly icm: Repository<InternalControlMapping>,
  ) {}

  private keyOk(h: string | undefined) {
    const expected = this.config.get('INTEGRATION_API_KEY');
    if (!expected?.length) return false;
    return h === `Bearer ${expected}` || h === expected;
  }

  /** Global integration key + first admin user as actor (same contract as JwtAuthGuard integration-key path). */
  private async integrationActor(auth: string | undefined) {
    if (!this.keyOk(auth)) {
      throw new UnauthorizedException('Invalid integration key');
    }
    const actor = await this.auth.getIntegrationActorUser();
    if (!actor) {
      throw new UnauthorizedException(
        'Integration key configured but no admin user exists for actor',
      );
    }
    return actor;
  }

  @Post('ci/evidence')
  @ApiOperation({
    summary: 'CI pipeline evidence (legacy)',
    description:
      'Requires `INTEGRATION_API_KEY` as `Authorization: Bearer <key>` (or raw key).',
  })
  @ApiBearerAuth('bearer')
  @ApiUnauthorizedResponse({ description: 'Invalid integration key' })
  async ci(
    @Headers('authorization') auth: string,
    @Body() b: CiEvidenceIngestDto,
  ) {
    if (!this.keyOk(auth))
      throw new UnauthorizedException('Invalid integration key');
    const item = await this.items.findOne({ where: { id: b.checklistItemId } });
    if (!item) throw new NotFoundException('Checklist item not found');
    return this.ev.save(
      this.ev.create({
        checklistItemId: b.checklistItemId,
        externalUri: b.buildUrl,
        filename: 'ci-pipeline',
        sourceConnector: 'ci',
        metadata: {
          commit: b.commit,
          passed: b.passed,
          log: b.log,
        },
      }),
    );
  }

  @Post('scanner/summary')
  @ApiOperation({
    summary: 'Scanner summary evidence (legacy)',
    description:
      'Requires `INTEGRATION_API_KEY` as `Authorization: Bearer <key>` (or raw key).',
  })
  @ApiBearerAuth('bearer')
  @ApiUnauthorizedResponse({ description: 'Invalid integration key' })
  async scanner(
    @Headers('authorization') auth: string,
    @Body() b: ScannerSummaryIngestDto,
  ) {
    if (!this.keyOk(auth))
      throw new UnauthorizedException('Invalid integration key');
    const item = await this.items.findOne({ where: { id: b.checklistItemId } });
    if (!item) throw new NotFoundException('Checklist item not found');
    return this.ev.save(
      this.ev.create({
        checklistItemId: b.checklistItemId,
        externalUri: b.reportUrl,
        filename: `${b.scanner || 'scanner'}-summary`,
        sourceConnector: 'vuln_scanner',
        metadata: {
          critical: b.critical,
          high: b.high,
          medium: b.medium,
          low: b.low,
        },
      }),
    );
  }

  @Post('v1/evidence')
  @ApiOperation({
    summary: 'Upsert evidence',
    description: 'Project integration key: `Authorization: Bearer <project-integration-key>`.',
  })
  @ApiBearerAuth('bearer')
  @ApiSecurity('idempotency-key')
  async upsertEvidence(
    @Headers('authorization') auth: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: EvidenceUpsertRequestDto,
  ) {
    await this.integrationEvidence.authenticateProjectKey(dto.projectId, auth);
    this.integrationEvidence.enforceRateLimit(dto.projectId);
    return this.integrationEvidence.upsertEvidence(dto, idempotencyKey);
  }

  @Post('v1/projects')
  @ApiOperation({
    summary: 'Create project (integration)',
    description: 'Requires global `INTEGRATION_API_KEY` in Authorization.',
  })
  @ApiBearerAuth('bearer')
  @ApiUnauthorizedResponse({ description: 'Invalid integration key' })
  async createProjectV1(
    @Headers('authorization') auth: string,
    @Body() dto: CreateIntegrationProjectRequestDto,
  ) {
    if (!this.keyOk(auth))
      throw new UnauthorizedException('Invalid integration key');
    return this.integrationEvidence.createProjectForIntegration(dto);
  }

  @Post('v1/evidence/bulk')
  @ApiOperation({ summary: 'Bulk ingest evidence' })
  @ApiBearerAuth('bearer')
  @ApiSecurity('idempotency-key')
  async bulkEvidence(
    @Headers('authorization') auth: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: EvidenceBulkIngestRequestDto,
  ) {
    await this.integrationEvidence.authenticateProjectKey(dto.projectId, auth);
    this.integrationEvidence.enforceRateLimit(dto.projectId);
    return this.integrationEvidence.bulkIngest(dto, idempotencyKey);
  }

  @Post('v1/controls/link')
  @ApiOperation({ summary: 'Link checklist item to control' })
  @ApiBearerAuth('bearer')
  async linkControl(
    @Headers('authorization') auth: string,
    @Body() dto: LinkControlRequestDto,
  ) {
    await this.integrationEvidence.authenticateProjectKey(dto.projectId, auth);
    this.integrationEvidence.enforceRateLimit(dto.projectId);
    return this.integrationEvidence.linkControl(dto);
  }

  @Post('v1/controls/resolve')
  @ApiOperation({ summary: 'Resolve control mapping' })
  @ApiBearerAuth('bearer')
  async resolveControl(
    @Headers('authorization') auth: string,
    @Body() dto: ResolveControlRequestDto,
  ) {
    await this.integrationEvidence.authenticateProjectKey(dto.projectId, auth);
    this.integrationEvidence.enforceRateLimit(dto.projectId);
    return this.integrationEvidence.resolveControl(dto);
  }

  @Post('v1/auto-scope/trigger')
  @ApiOperation({ summary: 'Trigger auto-scope' })
  @ApiBearerAuth('bearer')
  async triggerAutoScope(
    @Headers('authorization') auth: string,
    @Body() dto: AutoScopeTriggerRequestDto,
  ) {
    await this.integrationEvidence.authenticateProjectKey(dto.projectId, auth);
    this.integrationEvidence.enforceRateLimit(dto.projectId);
    return this.integrationEvidence.triggerAutoScope(dto);
  }

  @Get('v1/projects/:projectId/ingest/:requestId')
  @ApiOperation({ summary: 'Bulk ingest status' })
  @ApiBearerAuth('bearer')
  async ingestStatus(
    @Headers('authorization') auth: string,
    @Param('projectId') projectId: string,
    @Param('requestId') requestId: string,
  ) {
    await this.integrationEvidence.authenticateProjectKey(projectId, auth);
    this.integrationEvidence.enforceRateLimit(projectId);
    return this.integrationEvidence.ingestStatus(projectId, requestId);
  }

  @Get('v1/projects/:projectId/export')
  @ApiOperation({
    summary: 'Export project',
    description:
      '`format`: default JSON SSP bundle; `markdown` or `md` returns `{ format, content }`; `oscal-ssp` returns OSCAL JSON.',
  })
  @ApiProduces('application/json')
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'md', 'markdown', 'oscal-ssp'] })
  @ApiBearerAuth('bearer')
  @ApiOkResponse({
    description: 'JSON export, OSCAL SSP object, or markdown wrapper',
    schema: {
      oneOf: [
        { type: 'object', additionalProperties: true },
        {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['markdown'] },
            content: { type: 'string' },
          },
        },
      ],
    },
  })
  async exportProjectV1(
    @Headers('authorization') auth: string,
    @Param('projectId') projectId: string,
    @Query('format') format?: string,
  ) {
    await this.integrationEvidence.authenticateProjectKey(projectId, auth);
    this.integrationEvidence.enforceRateLimit(projectId);
    if (format === 'oscal-ssp') {
      return this.exportSvc.exportOscalSspJson(projectId);
    }
    if (format === 'md' || format === 'markdown') {
      return {
        format: 'markdown',
        content: await this.exportSvc.exportMarkdown(projectId),
      };
    }
    return this.exportSvc.exportJson(projectId);
  }

  @Get('v1/projects/:projectId/poam')
  @ApiOperation({
    summary: 'Export POA&M',
    description:
      '`format`: default JSON; `csv` or `markdown`/`md` return `{ format, content }`; `oscal-poam` returns OSCAL POA&M JSON.',
  })
  @ApiProduces('application/json')
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['json', 'csv', 'md', 'markdown', 'oscal-poam'],
  })
  @ApiBearerAuth('bearer')
  @ApiOkResponse({
    description: 'POA&M JSON, OSCAL, CSV wrapper, or markdown wrapper',
    schema: {
      oneOf: [
        { type: 'object', additionalProperties: true },
        {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['csv', 'markdown'] },
            content: { type: 'string' },
          },
        },
      ],
    },
  })
  async exportPoamV1(
    @Headers('authorization') auth: string,
    @Param('projectId') projectId: string,
    @Query('format') format?: string,
  ) {
    await this.integrationEvidence.authenticateProjectKey(projectId, auth);
    this.integrationEvidence.enforceRateLimit(projectId);
    if (format === 'oscal-poam') {
      return this.exportSvc.exportOscalPoamJson(projectId);
    }
    if (format === 'csv') {
      return {
        format: 'csv',
        content: await this.exportSvc.exportPoamCsv(projectId),
      };
    }
    if (format === 'md' || format === 'markdown') {
      return {
        format: 'markdown',
        content: await this.exportSvc.exportPoamMarkdown(projectId),
      };
    }
    return this.exportSvc.exportPoamJson(projectId);
  }

  @Post('v1/projects/:projectId/credentials')
  @ApiOperation({ summary: 'Create integration API credential (JWT user)' })
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard)
  async createCredential(
    @Param('projectId') projectId: string,
    @Body() body: CreateIntegrationCredentialBodyDto,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    const dto: CreateIntegrationCredentialDto = {
      projectId,
      label: body.label,
    };
    return this.integrationEvidence.createCredential(
      dto,
      req.user.userId,
      req.user.role,
    );
  }

  @Get('v1/projects/:projectId/credentials')
  @ApiOperation({ summary: 'List integration credentials' })
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard)
  async listCredentials(
    @Param('projectId') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    return this.integrationEvidence.listCredentials(
      projectId,
      req.user.userId,
      req.user.role,
    );
  }

  @Delete('v1/projects/:projectId/credentials/:credentialId')
  @ApiOperation({ summary: 'Revoke integration credential' })
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard)
  async revokeCredential(
    @Param('projectId') projectId: string,
    @Param('credentialId') credentialId: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    return this.integrationEvidence.revokeCredential(
      projectId,
      credentialId,
      req.user.userId,
      req.user.role,
    );
  }

  @Get('v1/projects/:projectId/connectors/registry')
  @ApiOperation({ summary: 'Connector registry metadata' })
  @ApiBearerAuth('bearer')
  async connectorsRegistryV1(
    @Headers('authorization') auth: string,
    @Param('projectId') projectId: string,
  ) {
    await this.integrationEvidence.authenticateProjectKey(projectId, auth);
    this.integrationEvidence.enforceRateLimit(projectId);
    return this.connectorInstances.listRegistry();
  }

  @Get('v1/projects/:projectId/connectors/status/summary')
  @ApiOperation({ summary: 'Connector status summary' })
  @ApiBearerAuth('bearer')
  async connectorsStatusV1(
    @Headers('authorization') auth: string,
    @Param('projectId') projectId: string,
  ) {
    await this.integrationEvidence.authenticateProjectKey(projectId, auth);
    this.integrationEvidence.enforceRateLimit(projectId);
    return this.connectorInstances.projectConnectorStatusForIntegration(projectId);
  }

  @Get('v1/projects/:projectId/connectors')
  @ApiOperation({ summary: 'List connector instances' })
  @ApiBearerAuth('bearer')
  async connectorsListV1(
    @Headers('authorization') auth: string,
    @Param('projectId') projectId: string,
  ) {
    await this.integrationEvidence.authenticateProjectKey(projectId, auth);
    this.integrationEvidence.enforceRateLimit(projectId);
    return this.connectorInstances.listInstancesForIntegration(projectId);
  }

  @Post('v1/projects/:projectId/connectors')
  @ApiOperation({ summary: 'Create connector instance' })
  @ApiBearerAuth('bearer')
  async connectorsCreateV1(
    @Headers('authorization') auth: string,
    @Param('projectId') projectId: string,
    @Body() body: CreateConnectorInstanceDto,
  ) {
    await this.integrationEvidence.authenticateProjectKey(projectId, auth);
    this.integrationEvidence.enforceRateLimit(projectId);
    return this.connectorInstances.createInstanceForIntegration(projectId, body);
  }

  @Get('v1/projects/:projectId/connectors/:instanceId/runs')
  @ApiOperation({ summary: 'List connector runs' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiBearerAuth('bearer')
  async connectorsRunsV1(
    @Headers('authorization') auth: string,
    @Param('projectId') projectId: string,
    @Param('instanceId') instanceId: string,
    @Query('limit') limit?: string,
  ) {
    await this.integrationEvidence.authenticateProjectKey(projectId, auth);
    this.integrationEvidence.enforceRateLimit(projectId);
    const n = limit ? parseInt(limit, 10) : 20;
    return this.connectorInstances.listRunsForIntegration(
      projectId,
      instanceId,
      Number.isFinite(n) ? n : 20,
    );
  }

  @Get('v1/projects/:projectId/connectors/:instanceId')
  async connectorsGetV1(
    @Headers('authorization') auth: string,
    @Param('projectId') projectId: string,
    @Param('instanceId') instanceId: string,
  ) {
    await this.integrationEvidence.authenticateProjectKey(projectId, auth);
    this.integrationEvidence.enforceRateLimit(projectId);
    return this.connectorInstances.getInstanceForIntegration(projectId, instanceId);
  }

  @Patch('v1/projects/:projectId/connectors/:instanceId')
  @ApiOperation({ summary: 'Update connector instance' })
  @ApiBearerAuth('bearer')
  async connectorsPatchV1(
    @Headers('authorization') auth: string,
    @Param('projectId') projectId: string,
    @Param('instanceId') instanceId: string,
    @Body() body: UpdateConnectorInstanceDto,
  ) {
    await this.integrationEvidence.authenticateProjectKey(projectId, auth);
    this.integrationEvidence.enforceRateLimit(projectId);
    return this.connectorInstances.updateInstanceForIntegration(projectId, instanceId, body);
  }

  @Delete('v1/projects/:projectId/connectors/:instanceId')
  @ApiOperation({ summary: 'Delete connector instance' })
  @ApiBearerAuth('bearer')
  async connectorsDeleteV1(
    @Headers('authorization') auth: string,
    @Param('projectId') projectId: string,
    @Param('instanceId') instanceId: string,
  ) {
    await this.integrationEvidence.authenticateProjectKey(projectId, auth);
    this.integrationEvidence.enforceRateLimit(projectId);
    return this.connectorInstances.deleteInstanceForIntegration(projectId, instanceId);
  }

  @Post('v1/projects/:projectId/connectors/:instanceId/run')
  @ApiOperation({ summary: 'Trigger connector run' })
  @ApiBearerAuth('bearer')
  async connectorsRunV1(
    @Headers('authorization') auth: string,
    @Param('projectId') projectId: string,
    @Param('instanceId') instanceId: string,
  ) {
    await this.integrationEvidence.authenticateProjectKey(projectId, auth);
    this.integrationEvidence.enforceRateLimit(projectId);
    return this.connectorInstances.triggerRunForIntegration(projectId, instanceId);
  }

  // --- Global integration API key (INTEGRATION_API_KEY) + admin actor ---

  @Get('v1/dashboard/stats')
  @ApiOperation({
    summary: 'Dashboard stats (global)',
    description: 'Requires INTEGRATION_API_KEY; uses first admin user as actor.',
  })
  @ApiBearerAuth('bearer')
  async integrationDashboardStats(@Headers('authorization') h: string) {
    await this.integrationActor(h);
    return this.dashboard.getStats();
  }

  @Get('v1/projects/:projectId/stats')
  @ApiOperation({ summary: 'Project dashboard stats' })
  @ApiBearerAuth('bearer')
  async integrationProjectStats(
    @Headers('authorization') h: string,
    @Param('projectId') projectId: string,
  ) {
    const actor = await this.integrationActor(h);
    await this.projects.assertAccess(projectId, actor.userId, actor.role);
    return this.dashboard.getStats(projectId);
  }

  @Get('v1/projects/:projectId/conmon')
  @ApiOperation({ summary: 'Continuous monitoring summary' })
  @ApiBearerAuth('bearer')
  async integrationProjectConmon(
    @Headers('authorization') h: string,
    @Param('projectId') projectId: string,
  ) {
    const actor = await this.integrationActor(h);
    await this.projects.assertAccess(projectId, actor.userId, actor.role);
    return this.dashboard.getConMonSummary(projectId);
  }

  @Get('v1/projects/:projectId/executive-briefing')
  @ApiOperation({ summary: 'Executive briefing (stats + risk heatmap)' })
  @ApiBearerAuth('bearer')
  async integrationExecutiveBriefing(
    @Headers('authorization') h: string,
    @Param('projectId') projectId: string,
  ) {
    const actor = await this.integrationActor(h);
    await this.projects.assertAccess(projectId, actor.userId, actor.role);
    const s = await this.dashboard.getStats(projectId);
    const heat = await this.risks.heatmap(
      projectId,
      actor.userId,
      actor.role,
    );
    return {
      summary: `Readiness ${s.readinessPct}% across ${s.totalControls} controls.`,
      stats: s,
      riskHeatmap: heat,
    };
  }

  @Get('v1/projects/:projectId/risks')
  @ApiOperation({ summary: 'List risks (paginated)' })
  @ApiBearerAuth('bearer')
  async integrationRisksList(
    @Headers('authorization') h: string,
    @Param('projectId') projectId: string,
    @Query() q: RiskListQueryDto,
  ) {
    const actor = await this.integrationActor(h);
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
      actor.userId,
      actor.role,
      paging,
      sort,
    );
  }

  @Post('v1/projects/:projectId/risks')
  @ApiOperation({ summary: 'Create risk' })
  @ApiBearerAuth('bearer')
  async integrationRisksCreate(
    @Headers('authorization') h: string,
    @Param('projectId') projectId: string,
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
    const actor = await this.integrationActor(h);
    return this.risks.create(projectId, actor.userId, actor.role, b);
  }

  @Get('v1/projects/:projectId/risks/heatmap')
  @ApiOperation({ summary: 'Risk heatmap' })
  @ApiBearerAuth('bearer')
  async integrationRisksHeatmap(
    @Headers('authorization') h: string,
    @Param('projectId') projectId: string,
  ) {
    const actor = await this.integrationActor(h);
    return this.risks.heatmap(projectId, actor.userId, actor.role);
  }

  @Patch('v1/projects/:projectId/risks/:riskId')
  @ApiOperation({ summary: 'Update risk' })
  @ApiBearerAuth('bearer')
  async integrationRisksPatch(
    @Headers('authorization') h: string,
    @Param('projectId') projectId: string,
    @Param('riskId') riskId: string,
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
    const actor = await this.integrationActor(h);
    return this.risks.patch(
      projectId,
      riskId,
      actor.userId,
      actor.role,
      b,
    );
  }

  @Post('v1/policies')
  @ApiOperation({ summary: 'Create policy' })
  @ApiBearerAuth('bearer')
  async integrationPoliciesCreate(
    @Headers('authorization') h: string,
    @Body() dto: CreatePolicyDto,
  ) {
    const actor = await this.integrationActor(h);
    return this.policies.create(actor.userId, actor.role, dto);
  }

  @Patch('v1/policies/:policyId')
  @ApiOperation({ summary: 'Update policy' })
  @ApiBearerAuth('bearer')
  async integrationPoliciesPatch(
    @Headers('authorization') h: string,
    @Param('policyId') policyId: string,
    @Body() dto: UpdatePolicyDto,
  ) {
    const actor = await this.integrationActor(h);
    return this.policies.update(policyId, actor.userId, actor.role, dto);
  }

  @Post('v1/policies/:policyId/publish')
  @ApiOperation({ summary: 'Publish policy' })
  @ApiBearerAuth('bearer')
  async integrationPoliciesPublish(
    @Headers('authorization') h: string,
    @Param('policyId') policyId: string,
    @Body() body: { changeDescription?: string },
  ) {
    const actor = await this.integrationActor(h);
    return this.policies.publish(
      policyId,
      actor.userId,
      actor.role,
      body?.changeDescription,
    );
  }

  @Post('v1/policies/generate')
  @ApiOperation({ summary: 'Generate policies from templates' })
  @ApiBearerAuth('bearer')
  async integrationPoliciesGenerate(
    @Headers('authorization') h: string,
    @Body()
    b: {
      projectId: string;
      slugs?: string[];
      organizationName?: string;
      systemName?: string;
    },
  ) {
    const actor = await this.integrationActor(h);
    return this.policies.generateFromTemplates(
      actor.userId,
      actor.role,
      b.projectId,
      b.slugs,
      b.organizationName,
      b.systemName,
    );
  }

  @Post('v1/pipeline/check')
  @ApiOperation({ summary: 'CI gate: pass/fail from readiness threshold' })
  @ApiBearerAuth('bearer')
  async integrationPipelineCheck(
    @Headers('authorization') h: string,
    @Body() b: { projectId: string; minReadinessPct?: number },
  ) {
    const actor = await this.integrationActor(h);
    await this.projects.assertAccess(b.projectId, actor.userId, actor.role);
    const s = await this.dashboard.getStats(b.projectId);
    const min = b.minReadinessPct ?? 80;
    const pass = s.readinessPct >= min;
    await this.pipelineChecks.save(
      this.pipelineChecks.create({
        projectId: b.projectId,
        status: pass ? 'pass' : 'fail',
        detail: JSON.stringify({ readinessPct: s.readinessPct, min }),
      }),
    );
    return { pass, readinessPct: s.readinessPct, minReadinessPct: min };
  }

  @Patch('v1/checklist-items/bulk')
  @ApiOperation({ summary: 'Bulk update checklist items' })
  @ApiBearerAuth('bearer')
  async integrationChecklistBulk(
    @Headers('authorization') h: string,
    @Body() b: BulkChecklistPatchDto,
  ) {
    const actor = await this.integrationActor(h);
    const updated: ChecklistItem[] = [];
    await this.ds.transaction(async (em) => {
      for (const id of b.ids) {
        const item = await em.findOne(ChecklistItem, {
          where: { id },
          relations: ['project'],
        });
        if (!item) continue;
        await this.projects.assertAccess(
          item.projectId,
          actor.userId,
          actor.role,
        );
        if (b.status != null)
          item.status = b.status as ChecklistItemStatus;
        if (b.ownerUserId !== undefined)
          item.ownerUserId = b.ownerUserId || null;
        if (b.dueDate !== undefined)
          item.dueDate = b.dueDate ? new Date(b.dueDate) : null;
        await em.save(item);
        updated.push(item);
        await this.audit.log(
          actor.userId,
          'checklist.bulk_update',
          'checklist_item',
          id,
          {
            patch: {
              status: b.status,
              ownerUserId: b.ownerUserId,
              dueDate: b.dueDate,
            },
          },
        );
      }
    });
    return { updated: updated.length, items: updated };
  }

  @Patch('v1/checklist-items/:id')
  @ApiOperation({ summary: 'Update checklist item' })
  @ApiBearerAuth('bearer')
  async integrationChecklistPatch(
    @Headers('authorization') h: string,
    @Param('id') id: string,
    @Body() b: PatchChecklistItemDto,
  ) {
    const actor = await this.integrationActor(h);
    const item = await this.items.findOne({
      where: { id },
      relations: ['project'],
    });
    if (!item) throw new NotFoundException('Checklist item not found');
    await this.projects.assertAccess(
      item.projectId,
      actor.userId,
      actor.role,
    );
    const prev = { ...item };
    if (b.status != null) item.status = b.status as ChecklistItemStatus;
    if (b.ownerUserId !== undefined) item.ownerUserId = b.ownerUserId || null;
    if (b.dueDate !== undefined)
      item.dueDate = b.dueDate ? new Date(b.dueDate) : null;
    if (b.reviewState !== undefined) item.reviewState = b.reviewState;
    await this.items.save(item);
    if (b.ownerUserId && b.ownerUserId !== prev.ownerUserId) {
      await this.notifications.notify(b.ownerUserId, 'task.assigned', {
        checklistItemId: id,
        projectId: item.projectId,
      });
    }
    await this.webhooks.deliver(item.projectId, 'checklist.updated', {
      checklistItemId: id,
      changes: b,
    });
    await this.audit.log(
      actor.userId,
      'checklist.update',
      'checklist_item',
      id,
      { ...b },
    );
    return item;
  }

  @Get('v1/projects/:projectId/auto-scope/recommendations')
  @ApiOperation({ summary: 'List auto-scope recommendations' })
  @ApiBearerAuth('bearer')
  async integrationAutoScopeRecommendations(
    @Headers('authorization') h: string,
    @Param('projectId') projectId: string,
    @Query() q: AutoScopeRecommendationListQueryDto,
  ) {
    const actor = await this.integrationActor(h);
    const paging = skipTakeFromPageLimit(q);
    const sort = parseSortParam(
      q.sort ?? '-createdAt',
      { createdAt: 'r.created_at', confidence: 'r.confidence' },
      'createdAt',
    );
    return this.autoScope.listRecommendations(
      projectId,
      actor.userId,
      actor.role,
      {
        status: q.status,
        decision: q.decision,
        runId: q.runId,
        minConfidence: q.minConfidence,
      },
      paging,
      sort,
    );
  }

  @Post('v1/projects/:projectId/auto-scope/recommendations/:recommendationId/approve')
  @ApiOperation({ summary: 'Approve auto-scope recommendation' })
  @ApiBearerAuth('bearer')
  async integrationAutoScopeApprove(
    @Headers('authorization') h: string,
    @Param('projectId') projectId: string,
    @Param('recommendationId') recommendationId: string,
    @Body() body: { notes?: string },
  ) {
    const actor = await this.integrationActor(h);
    return this.autoScope.approveRecommendation(
      projectId,
      recommendationId,
      actor.userId,
      actor.role,
      body?.notes,
    );
  }

  @Get('v1/catalog/cross-map')
  @ApiOperation({ summary: 'Cross-framework control mappings' })
  @ApiBearerAuth('bearer')
  async integrationCatalogCrossMap(
    @Headers('authorization') h: string,
    @Query('sourceFramework') sourceFramework?: string,
    @Query('targetFramework') targetFramework?: string,
  ) {
    await this.integrationActor(h);
    const qb = this.icm
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.catalogRequirement', 'cr')
      .leftJoinAndSelect('cr.frameworkRelease', 'fr')
      .leftJoinAndSelect('fr.framework', 'fw')
      .leftJoinAndSelect('m.internalControl', 'ic');
    if (sourceFramework) {
      qb.andWhere('fw.code = :sourceFramework', { sourceFramework });
    }
    if (targetFramework) {
      qb.andWhere('m.frameworkCode = :targetFramework OR m.frameworkCode IS NULL', {
        targetFramework,
      });
    }
    const items = await qb.orderBy('m.priorityRank', 'ASC').take(2000).getMany();
    return {
      sourceFramework: sourceFramework ?? null,
      targetFramework: targetFramework ?? null,
      mappings: items.map((m) => ({
        id: m.id,
        internalControlId: m.internalControlId,
        internalControlCode: m.internalControl?.code ?? null,
        catalogRequirementId: m.catalogRequirementId,
        requirementCode: m.catalogRequirement?.requirementCode ?? null,
        frameworkCode: m.frameworkCode,
        mappingType: m.mappingType,
        coverage: m.coverage,
      })),
      total: items.length,
    };
  }

  @Post('v1/findings')
  @ApiOperation({ summary: 'Create checklist finding' })
  @ApiBearerAuth('bearer')
  async integrationFindingsCreate(
    @Headers('authorization') h: string,
    @Body()
    b: {
      checklistItemId: string;
      title: string;
      description?: string;
      severity?: string;
    },
  ) {
    const actor = await this.integrationActor(h);
    return this.findings.create(actor.userId, actor.role, b);
  }

  @Get('v1/checklist-items/:checklistItemId/findings')
  @ApiOperation({ summary: 'List findings for checklist item' })
  @ApiBearerAuth('bearer')
  async integrationFindingsByChecklist(
    @Headers('authorization') h: string,
    @Param('checklistItemId') checklistItemId: string,
    @Query() q: FindingListQueryDto,
  ) {
    const actor = await this.integrationActor(h);
    return this.findings.listByChecklist(
      checklistItemId,
      actor.userId,
      actor.role,
      q,
    );
  }

  @Post('v1/projects/:projectId/audits')
  @ApiOperation({ summary: 'Create GRC audit' })
  @ApiBearerAuth('bearer')
  async integrationAuditsCreate(
    @Headers('authorization') h: string,
    @Param('projectId') projectId: string,
    @Body()
    b: {
      type: 'internal' | 'external' | '3pao';
      scope?: string;
      plannedStart?: string;
      plannedEnd?: string;
    },
  ) {
    const actor = await this.integrationActor(h);
    await this.projects.assertAccess(projectId, actor.userId, actor.role);
    const row = this.audits.create({
      projectId,
      type: b.type,
      status: 'planned',
      leadAuditorUserId: actor.userId,
      scope: b.scope ?? null,
      plannedStart: b.plannedStart ? new Date(b.plannedStart) : null,
      plannedEnd: b.plannedEnd ? new Date(b.plannedEnd) : null,
    });
    return this.audits.save(row);
  }

  @Post('v1/projects/:projectId/incidents')
  @ApiOperation({ summary: 'Create incident' })
  @ApiBearerAuth('bearer')
  async integrationIncidentsCreate(
    @Headers('authorization') h: string,
    @Param('projectId') projectId: string,
    @Body()
    b: {
      title: string;
      severity: 'P1' | 'P2' | 'P3' | 'P4';
      status?: string;
      description?: string;
    },
  ) {
    const actor = await this.integrationActor(h);
    await this.projects.assertAccess(projectId, actor.userId, actor.role);
    return this.incidents.save(
      this.incidents.create({
        projectId,
        title: b.title,
        severity: b.severity,
        status: b.status || 'new',
        description: b.description ?? null,
        ownerUserId: actor.userId,
      }),
    );
  }

  @Get('v1/projects/:projectId/vendors')
  @ApiOperation({ summary: 'List vendors' })
  @ApiBearerAuth('bearer')
  async integrationVendorsList(
    @Headers('authorization') h: string,
    @Param('projectId') projectId: string,
  ) {
    const actor = await this.integrationActor(h);
    await this.projects.assertAccess(projectId, actor.userId, actor.role);
    return this.vendors.find({ where: { projectId } });
  }
}
