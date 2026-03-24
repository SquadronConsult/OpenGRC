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

@ApiTags('integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly config: ConfigService,
    private readonly integrationEvidence: IntegrationEvidenceService,
    private readonly exportSvc: ExportService,
    private readonly connectorInstances: ConnectorInstanceService,
    @InjectRepository(EvidenceItem) private readonly ev: Repository<EvidenceItem>,
    @InjectRepository(ChecklistItem) private readonly items: Repository<ChecklistItem>,
  ) {}

  private keyOk(h: string | undefined) {
    const expected = this.config.get('INTEGRATION_API_KEY');
    if (!expected?.length) return false;
    return h === `Bearer ${expected}` || h === expected;
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
}
