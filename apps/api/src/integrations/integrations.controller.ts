import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
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
  CreateIntegrationCredentialDto,
  CreateIntegrationProjectRequestDto,
  EvidenceBulkIngestRequestDto,
  EvidenceUpsertRequestDto,
  LinkControlRequestDto,
  ResolveControlRequestDto,
} from './dto/integration-v1.dto';

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly config: ConfigService,
    private readonly integrationEvidence: IntegrationEvidenceService,
    private readonly exportSvc: ExportService,
    @InjectRepository(EvidenceItem) private readonly ev: Repository<EvidenceItem>,
    @InjectRepository(ChecklistItem) private readonly items: Repository<ChecklistItem>,
  ) {}

  private keyOk(h: string | undefined) {
    const expected = this.config.get('INTEGRATION_API_KEY');
    if (!expected?.length) return false;
    return h === `Bearer ${expected}` || h === expected;
  }

  @Post('ci/evidence')
  async ci(
    @Headers('authorization') auth: string,
    @Body()
    b: {
      checklistItemId: string;
      buildUrl?: string;
      commit?: string;
      passed?: boolean;
      log?: string;
    },
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
  async scanner(
    @Headers('authorization') auth: string,
    @Body()
    b: {
      checklistItemId: string;
      scanner?: string;
      critical?: number;
      high?: number;
      medium?: number;
      low?: number;
      reportUrl?: string;
    },
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
  async createProjectV1(
    @Headers('authorization') auth: string,
    @Body() dto: CreateIntegrationProjectRequestDto,
  ) {
    if (!this.keyOk(auth))
      throw new UnauthorizedException('Invalid integration key');
    return this.integrationEvidence.createProjectForIntegration(dto);
  }

  @Post('v1/evidence/bulk')
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
  async linkControl(
    @Headers('authorization') auth: string,
    @Body() dto: LinkControlRequestDto,
  ) {
    await this.integrationEvidence.authenticateProjectKey(dto.projectId, auth);
    this.integrationEvidence.enforceRateLimit(dto.projectId);
    return this.integrationEvidence.linkControl(dto);
  }

  @Post('v1/controls/resolve')
  async resolveControl(
    @Headers('authorization') auth: string,
    @Body() dto: ResolveControlRequestDto,
  ) {
    await this.integrationEvidence.authenticateProjectKey(dto.projectId, auth);
    this.integrationEvidence.enforceRateLimit(dto.projectId);
    return this.integrationEvidence.resolveControl(dto);
  }

  @Post('v1/auto-scope/trigger')
  async triggerAutoScope(
    @Headers('authorization') auth: string,
    @Body() dto: AutoScopeTriggerRequestDto,
  ) {
    await this.integrationEvidence.authenticateProjectKey(dto.projectId, auth);
    this.integrationEvidence.enforceRateLimit(dto.projectId);
    return this.integrationEvidence.triggerAutoScope(dto);
  }

  @Get('v1/projects/:projectId/ingest/:requestId')
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
  @UseGuards(JwtAuthGuard)
  async createCredential(
    @Param('projectId') projectId: string,
    @Body() body: { label: string },
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
}
