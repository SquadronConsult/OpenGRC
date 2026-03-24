import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, createHash } from 'crypto';
import { Repository } from 'typeorm';
import { AutoScopeService } from '../auto-scope/auto-scope.service';
import { AutoScopeRunOptions } from '../auto-scope/auto-scope.types';
import { ChecklistService } from '../checklist/checklist.service';
import { ChecklistItem } from '../entities/checklist-item.entity';
import { EvidenceItem } from '../entities/evidence-item.entity';
import { FrrRequirement } from '../entities/frr-requirement.entity';
import { IntegrationControlLink } from '../entities/integration-control-link.entity';
import { IntegrationCredential } from '../entities/integration-credential.entity';
import { IntegrationIdempotency } from '../entities/integration-idempotency.entity';
import { KsiIndicator } from '../entities/ksi-indicator.entity';
import { Project } from '../entities/project.entity';
import { ProjectsService } from '../projects/projects.service';
import {
  AutoScopeTriggerRequestDto,
  CreateIntegrationCredentialDto,
  CreateIntegrationProjectRequestDto,
  EvidenceBulkIngestRequestDto,
  EvidenceUpsertItemDto,
  EvidenceUpsertRequestDto,
  LinkControlRequestDto,
  ResolveControlRequestDto,
} from './dto/integration-v1.dto';

type ResolveResult = {
  checklistItem: ChecklistItem;
  strategy: string;
  diagnostics: Record<string, unknown>;
};

const rateState = new Map<
  string,
  {
    windowStartMs: number;
    count: number;
  }
>();

function normalizeFramework(framework?: string) {
  const f = (framework || 'frmr').trim().toLowerCase();
  if (f === 'fedramp_frmr' || f === 'fedramp') return 'frmr';
  return f;
}

function normalizeControlId(controlId: string) {
  return controlId.trim();
}

function normalizeNist(control: string) {
  return control.toLowerCase().replace(/\s+/g, '').replace(/^([a-z]{2})[-_]?(\d+)/i, '$1-$2');
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

@Injectable()
export class IntegrationEvidenceService {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ChecklistItem)
    private readonly checklistItems: Repository<ChecklistItem>,
    @InjectRepository(EvidenceItem)
    private readonly evidenceItems: Repository<EvidenceItem>,
    @InjectRepository(FrrRequirement)
    private readonly frrRepo: Repository<FrrRequirement>,
    @InjectRepository(KsiIndicator)
    private readonly ksiRepo: Repository<KsiIndicator>,
    @InjectRepository(IntegrationControlLink)
    private readonly controlLinks: Repository<IntegrationControlLink>,
    @InjectRepository(IntegrationIdempotency)
    private readonly idempotencyRepo: Repository<IntegrationIdempotency>,
    @InjectRepository(IntegrationCredential)
    private readonly credentialRepo: Repository<IntegrationCredential>,
    private readonly projectsService: ProjectsService,
    private readonly checklistService: ChecklistService,
    private readonly autoScope: AutoScopeService,
  ) {}

  async createCredential(
    dto: CreateIntegrationCredentialDto,
    actorUserId: string,
    actorRole: string,
  ) {
    await this.projectsService.assertAccess(dto.projectId, actorUserId, actorRole);
    const project = await this.projects.findOne({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const plainKey = `grc_${randomBytes(24).toString('hex')}`;
    const keyHash = sha256(plainKey);
    const created = await this.credentialRepo.save(
      this.credentialRepo.create({
        projectId: dto.projectId,
        label: dto.label,
        apiKeyHash: keyHash,
        apiKeyPrefix: plainKey.slice(0, 12),
        kind: 'inbound',
        isActive: true,
      }),
    );
    return {
      id: created.id,
      projectId: created.projectId,
      label: created.label,
      apiKey: plainKey,
      apiKeyPrefix: created.apiKeyPrefix,
      createdAt: created.createdAt,
    };
  }

  async listCredentials(projectId: string, actorUserId: string, actorRole: string) {
    await this.projectsService.assertAccess(projectId, actorUserId, actorRole);
    const rows = await this.credentialRepo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      label: r.label,
      apiKeyPrefix: r.apiKeyPrefix,
      isActive: r.isActive,
      lastUsedAt: r.lastUsedAt,
      createdAt: r.createdAt,
    }));
  }

  async revokeCredential(
    projectId: string,
    credentialId: string,
    actorUserId: string,
    actorRole: string,
  ) {
    await this.projectsService.assertAccess(projectId, actorUserId, actorRole);
    const row = await this.credentialRepo.findOne({
      where: { id: credentialId, projectId },
    });
    if (!row) throw new NotFoundException('Credential not found');
    row.isActive = false;
    await this.credentialRepo.save(row);
    return { id: row.id, revoked: true };
  }

  async createProjectForIntegration(dto: CreateIntegrationProjectRequestDto) {
    const pathType = dto.pathType || '20x';
    const impactLevel = dto.impactLevel || 'moderate';
    const actorLabels = dto.actorLabels || (pathType === '20x' ? 'CSO,CSX' : 'CSO,CSL');

    const project = await this.projects.save(
      this.projects.create({
        name: dto.name,
        pathType,
        impactLevel,
        actorLabels,
        ...(dto.complianceStartDate
          ? { complianceStartDate: new Date(dto.complianceStartDate) }
          : {}),
      }),
    );

    const includeKsi = dto.includeKsi ?? pathType === '20x';
    const createdChecklistCount = await this.checklistService.generateChecklist(
      project.id,
      includeKsi,
    );
    const suggestedDueDateCount = await this.checklistService.applySuggestedDueDates(
      project.id,
    );
    const verificationHint = await this.buildVerificationHint(project.id);

    return {
      project: {
        id: project.id,
        name: project.name,
        pathType: project.pathType,
        impactLevel: project.impactLevel,
        actorLabels: project.actorLabels,
        complianceStartDate: project.complianceStartDate,
        createdAt: project.createdAt,
      },
      checklist: {
        createdCount: createdChecklistCount,
        dueDatesSuggestedCount: suggestedDueDateCount,
        includeKsi,
      },
      verificationHint,
    };
  }

  async authenticateProjectKey(projectId: string, authHeader?: string) {
    const token = this.extractToken(authHeader);
    if (!token) throw new UnauthorizedException('Missing integration bearer token');

    // Allow service-level integration key for MCP/automation flows that bootstrap
    // projects and then immediately execute project-scoped linkage endpoints.
    const globalKey = String(this.config.get('INTEGRATION_API_KEY') || '').trim();
    if (globalKey && token === globalKey) {
      return { mode: 'env-global' };
    }

    const keyHash = sha256(token);
    const byDb = await this.credentialRepo.findOne({
      where: { projectId, apiKeyHash: keyHash, isActive: true },
    });
    if (byDb) {
      byDb.lastUsedAt = new Date();
      await this.credentialRepo.save(byDb);
      return { mode: 'db', credentialId: byDb.id };
    }

    const envScoped = this.getEnvProjectKeys();
    if (envScoped.get(projectId) === token) {
      return { mode: 'env' };
    }

    throw new UnauthorizedException('Invalid project integration key');
  }

  enforceRateLimit(projectId: string) {
    const now = Date.now();
    const max = Number(this.config.get('INTEGRATION_V1_RATE_LIMIT_PER_MINUTE') || 300);
    const windowMs = 60_000;
    const current = rateState.get(projectId);
    if (!current || now - current.windowStartMs >= windowMs) {
      rateState.set(projectId, { windowStartMs: now, count: 1 });
      return;
    }
    current.count += 1;
    if (current.count > max) {
      throw new HttpException(
        `Integration rate limit exceeded for project. Max ${max} requests/min.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async upsertEvidence(dto: EvidenceUpsertRequestDto, idempotencyHeader?: string) {
    const effectiveIdempotency = dto.idempotencyKey || idempotencyHeader || null;
    return this.withIdempotency(
      dto.projectId,
      'evidence_upsert_v1',
      effectiveIdempotency,
      dto,
      async () => {
        const item = await this.ingestOne(dto.projectId, dto);
        return {
          requestType: 'evidence_upsert_v1',
          accepted: [item],
          rejected: [],
          errors: [],
          mappingDiagnostics: [item.mappingDiagnostics],
          requestId: null,
          replayed: false,
        };
      },
    );
  }

  /**
   * Internal: connector runner ingests without HTTP auth. Skips integration rate limits.
   */
  async ingestConnectorItems(
    projectId: string,
    items: EvidenceUpsertItemDto[],
  ): Promise<{
    accepted: Record<string, unknown>[];
    rejected: { controlId: string; reason: string }[];
  }> {
    const accepted: Record<string, unknown>[] = [];
    const rejected: { controlId: string; reason: string }[] = [];
    for (const evidence of items) {
      try {
        const ingested = await this.ingestOne(projectId, {
          ...evidence,
          metadata: {
            ...(evidence.metadata || {}),
            automated: true,
          },
        });
        accepted.push(ingested);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        rejected.push({
          controlId: evidence.controlId,
          reason: message,
        });
      }
    }
    return { accepted, rejected };
  }

  async bulkIngest(dto: EvidenceBulkIngestRequestDto, idempotencyHeader?: string) {
    const effectiveIdempotency = dto.idempotencyKey || idempotencyHeader || null;
    return this.withIdempotency(
      dto.projectId,
      'evidence_bulk_ingest_v1',
      effectiveIdempotency,
      dto,
      async () => {
        const accepted: Record<string, unknown>[] = [];
        const rejected: Record<string, unknown>[] = [];
        const errors: Record<string, unknown>[] = [];
        const mappingDiagnostics: Record<string, unknown>[] = [];
        for (const evidence of dto.items) {
          try {
            const ingested = await this.ingestOne(dto.projectId, evidence);
            accepted.push(ingested);
            mappingDiagnostics.push(ingested.mappingDiagnostics);
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            rejected.push({
              controlId: evidence.controlId,
              framework: normalizeFramework(evidence.framework),
              reason: message,
            });
            errors.push({
              controlId: evidence.controlId,
              error: message,
            });
          }
        }

        return {
          requestType: 'evidence_bulk_ingest_v1',
          accepted,
          rejected,
          errors,
          mappingDiagnostics,
          requestId: null,
          replayed: false,
        };
      },
    );
  }

  async ingestStatus(projectId: string, requestId: string) {
    const row = await this.idempotencyRepo.findOne({
      where: { id: requestId, projectId },
    });
    if (!row) throw new NotFoundException('Ingest request not found');
    return {
      requestId: row.id,
      projectId: row.projectId,
      requestType: row.requestType,
      status: row.status,
      response: row.responsePayload,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async linkControl(dto: LinkControlRequestDto) {
    const checklistItem = await this.checklistItems.findOne({
      where: { id: dto.checklistItemId, projectId: dto.projectId },
    });
    if (!checklistItem) {
      throw new NotFoundException('Checklist item not found in project');
    }
    const framework = normalizeFramework(dto.framework);
    const controlId = normalizeControlId(dto.controlId);
    const existing = await this.controlLinks.findOne({
      where: {
        projectId: dto.projectId,
        framework,
        externalControlId: controlId,
      },
    });
    if (existing && existing.checklistItemId !== dto.checklistItemId) {
      throw new ConflictException('Control is already linked to a different checklist item');
    }
    const row = existing || this.controlLinks.create();
    row.projectId = dto.projectId;
    row.framework = framework;
    row.externalControlId = controlId;
    row.checklistItemId = dto.checklistItemId;
    row.notes = dto.notes || null;
    const saved = await this.controlLinks.save(row);
    return {
      id: saved.id,
      projectId: saved.projectId,
      framework: saved.framework,
      controlId: saved.externalControlId,
      checklistItemId: saved.checklistItemId,
      notes: saved.notes,
      updatedAt: saved.updatedAt,
    };
  }

  async resolveControl(dto: ResolveControlRequestDto) {
    const resolved = await this.resolveChecklistItem(
      dto.projectId,
      dto.framework,
      dto.controlId,
      undefined,
    );
    return {
      projectId: dto.projectId,
      framework: normalizeFramework(dto.framework),
      controlId: dto.controlId,
      checklistItemId: resolved.checklistItem.id,
      strategy: resolved.strategy,
      mappingDiagnostics: resolved.diagnostics,
    };
  }

  async triggerAutoScope(dto: AutoScopeTriggerRequestDto) {
    const project = await this.projects.findOne({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('Project not found');
    const result = await this.autoScope.run(
      dto.projectId,
      project.ownerId || 'integration-bot',
      'admin',
      (dto.options || {}) as AutoScopeRunOptions,
    );
    return {
      projectId: dto.projectId,
      triggered: true,
      run: result,
    };
  }

  private async ingestOne(projectId: string, evidence: EvidenceUpsertItemDto) {
    const resolved = await this.resolveChecklistItem(
      projectId,
      evidence.framework,
      evidence.controlId,
      evidence.checklistItemId,
    );
    const metadata = {
      ...(evidence.metadata || {}),
      framework: normalizeFramework(evidence.framework),
      controlId: normalizeControlId(evidence.controlId),
      sourceRunId: evidence.sourceRunId || null,
      occurredAt: evidence.occurredAt || null,
      assertion: evidence.assertion || null,
      mappingStrategy: resolved.strategy,
    } as Record<string, unknown>;
    const saved = await this.evidenceItems.save(
      this.evidenceItems.create({
        checklistItemId: resolved.checklistItem.id,
        externalUri: evidence.externalUri || null,
        filename: `${evidence.evidenceType || 'evidence'}:${normalizeFramework(evidence.framework)}:${normalizeControlId(evidence.controlId)}`,
        sourceConnector: evidence.sourceConnector || 'integration_v1',
        metadata,
        artifactType: evidence.artifactType || null,
        sourceSystem: evidence.sourceSystem || null,
        collectionStart: evidence.collectionStart ? new Date(evidence.collectionStart) : null,
        collectionEnd: evidence.collectionEnd ? new Date(evidence.collectionEnd) : null,
      }),
    );
    return {
      evidenceId: saved.id,
      checklistItemId: saved.checklistItemId,
      controlId: normalizeControlId(evidence.controlId),
      framework: normalizeFramework(evidence.framework),
      mappingDiagnostics: resolved.diagnostics,
    };
  }

  private async resolveChecklistItem(
    projectId: string,
    frameworkInput: string | undefined,
    controlInput: string,
    checklistItemId?: string,
  ): Promise<ResolveResult> {
    if (checklistItemId) {
      const exact = await this.checklistItems.findOne({
        where: { id: checklistItemId, projectId },
        relations: [
          'frrRequirement',
          'ksiIndicator',
          'catalogRequirement',
          'catalogRequirement.frameworkRelease',
          'catalogRequirement.frameworkRelease.framework',
        ],
      });
      if (!exact) throw new NotFoundException('checklistItemId does not belong to project');
      return {
        checklistItem: exact,
        strategy: 'explicit_checklist_item_id',
        diagnostics: { checklistItemId: exact.id },
      };
    }

    const framework = normalizeFramework(frameworkInput);
    const controlId = normalizeControlId(controlInput);

    const linked = await this.controlLinks.findOne({
      where: {
        projectId,
        framework,
        externalControlId: controlId,
      },
    });
    if (linked) {
      const linkedItem = await this.checklistItems.findOne({
        where: { id: linked.checklistItemId, projectId },
        relations: [
          'frrRequirement',
          'ksiIndicator',
          'catalogRequirement',
          'catalogRequirement.frameworkRelease',
          'catalogRequirement.frameworkRelease.framework',
        ],
      });
      if (linkedItem) {
        return {
          checklistItem: linkedItem,
          strategy: 'explicit_link_table',
          diagnostics: { linkId: linked.id, checklistItemId: linkedItem.id },
        };
      }
    }

    if (framework !== 'frmr') {
      throw new NotFoundException(
        `No control mapping found for framework "${framework}". Add explicit control link first.`,
      );
    }

    const byItemId = await this.checklistItems.findOne({
      where: { id: controlId, projectId },
      relations: [
        'frrRequirement',
        'ksiIndicator',
        'catalogRequirement',
        'catalogRequirement.frameworkRelease',
        'catalogRequirement.frameworkRelease.framework',
      ],
    });
    if (byItemId) {
      return {
        checklistItem: byItemId,
        strategy: 'checklist_item_id_as_control',
        diagnostics: { checklistItemId: byItemId.id },
      };
    }

    const candidates = await this.resolveFrmrCandidates(projectId, controlId);
    if (candidates.length === 0) {
      throw new NotFoundException(
        `No checklist item found for control "${controlId}". Link the control first or provide checklistItemId.`,
      );
    }
    if (candidates.length > 1) {
      throw new ConflictException(
        `Ambiguous control reference "${controlId}" matched ${candidates.length} checklist items. Use explicit checklistItemId or create a link.`,
      );
    }
    return candidates[0];
  }

  private async resolveFrmrCandidates(projectId: string, controlId: string) {
    const normalizedControl = controlId.toLowerCase();
    if (normalizedControl.startsWith('frr:')) {
      const [processId, reqKey] = controlId.slice(4).split(':');
      if (processId && reqKey) {
        const item = await this.checklistItems
          .createQueryBuilder('item')
          .leftJoinAndSelect('item.frrRequirement', 'frr')
          .leftJoinAndSelect('item.ksiIndicator', 'ksi')
          .where('item.project_id = :projectId', { projectId })
          .andWhere('LOWER(frr.process_id) = LOWER(:processId)', { processId })
          .andWhere('LOWER(frr.req_key) = LOWER(:reqKey)', { reqKey })
          .getOne();
        return item
          ? [
              {
                checklistItem: item,
                strategy: 'frr_process_reqkey',
                diagnostics: { processId, reqKey },
              },
            ]
          : [];
      }
    }

    if (normalizedControl.startsWith('ksi:')) {
      const indicator = controlId.slice(4);
      const item = await this.checklistItems
        .createQueryBuilder('item')
        .leftJoinAndSelect('item.frrRequirement', 'frr')
        .leftJoinAndSelect('item.ksiIndicator', 'ksi')
        .where('item.project_id = :projectId', { projectId })
        .andWhere('LOWER(ksi.indicator_id) = LOWER(:indicator)', { indicator })
        .getOne();
      return item
        ? [
            {
              checklistItem: item,
              strategy: 'ksi_indicator_id',
              diagnostics: { indicatorId: indicator },
            },
          ]
        : [];
    }

    if (normalizedControl.startsWith('nist:')) {
      const nist = normalizeNist(controlId.slice(5));
      return this.findByNist(projectId, nist, 'nist_control');
    }

    const frrMatches = await this.checklistItems
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.frrRequirement', 'frr')
      .leftJoinAndSelect('item.ksiIndicator', 'ksi')
      .where('item.project_id = :projectId', { projectId })
      .andWhere('LOWER(frr.req_key) = LOWER(:reqKey)', { reqKey: controlId })
      .getMany();
    if (frrMatches.length > 0) {
      return frrMatches.map((match) => ({
        checklistItem: match,
        strategy: 'frr_req_key',
        diagnostics: {
          reqKey: controlId,
          processId: match.frrRequirement?.processId || null,
        },
      }));
    }

    const ksiMatches = await this.checklistItems
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.frrRequirement', 'frr')
      .leftJoinAndSelect('item.ksiIndicator', 'ksi')
      .where('item.project_id = :projectId', { projectId })
      .andWhere('LOWER(ksi.indicator_id) = LOWER(:indicatorId)', { indicatorId: controlId })
      .getMany();
    if (ksiMatches.length > 0) {
      return ksiMatches.map((match) => ({
        checklistItem: match,
        strategy: 'ksi_indicator_id',
        diagnostics: { indicatorId: controlId },
      }));
    }

    return this.findByNist(projectId, normalizeNist(controlId), 'nist_control_unprefixed');
  }

  private async findByNist(projectId: string, nist: string, strategy: string) {
    const items = await this.checklistItems.find({
      where: { projectId },
      relations: ['frrRequirement', 'ksiIndicator'],
    });
    const matches = items.filter((item) => {
      const controls = (item.ksiIndicator?.controls || []).map((c) => normalizeNist(String(c)));
      return controls.includes(nist);
    });
    return matches.map((match) => ({
      checklistItem: match,
      strategy,
      diagnostics: { nistControl: nist, ksiIndicatorId: match.ksiIndicatorId || null },
    }));
  }

  private async withIdempotency<T extends Record<string, unknown>>(
    projectId: string,
    requestType: string,
    idempotencyKey: string | null,
    payload: unknown,
    fn: () => Promise<T>,
  ) {
    const requestHash = sha256(stableStringify(payload));
    if (!idempotencyKey) {
      const fresh = await fn();
      return fresh;
    }

    const existing = await this.idempotencyRepo.findOne({
      where: { projectId, requestType, idempotencyKey },
    });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException(
          'Idempotency key reuse with different payload is not allowed',
        );
      }
      return {
        ...(existing.responsePayload || {}),
        requestId: existing.id,
        replayed: true,
      } as T & { requestId: string; replayed: boolean };
    }

    const response = await fn();
    const saved = await this.idempotencyRepo.save(
      this.idempotencyRepo.create({
        projectId,
        requestType,
        idempotencyKey,
        requestHash,
        status: 'accepted',
        responsePayload: response,
      }),
    );
    return {
      ...response,
      requestId: saved.id,
      replayed: false,
    } as T & { requestId: string; replayed: boolean };
  }

  private extractToken(authHeader?: string) {
    if (!authHeader) return '';
    const trimmed = authHeader.trim();
    if (trimmed.toLowerCase().startsWith('bearer ')) {
      return trimmed.slice(7).trim();
    }
    return trimmed;
  }

  private async buildVerificationHint(projectId: string) {
    const item = await this.checklistItems.findOne({
      where: { projectId },
      relations: [
        'frrRequirement',
        'ksiIndicator',
        'catalogRequirement',
        'catalogRequirement.frameworkRelease',
        'catalogRequirement.frameworkRelease.framework',
      ],
      order: { id: 'ASC' },
    });
    if (!item) {
      return {
        projectId,
        checklistItemId: null,
        framework: 'frmr',
        controlId: null,
        linkRequired: true,
        diagnostics: { reason: 'No checklist item generated for project' },
      };
    }

    let controlId: string;
    let strategy: string;
    if (item.catalogRequirement?.requirementCode) {
      const fc =
        item.catalogRequirement.frameworkRelease?.framework?.code || 'fedramp_frmr';
      controlId = `${fc}:${item.catalogRequirement.requirementCode}`;
      strategy = 'catalog_requirement_code';
    } else if (item.frrRequirement?.processId && item.frrRequirement?.reqKey) {
      controlId = `frr:${item.frrRequirement.processId}:${item.frrRequirement.reqKey}`;
      strategy = 'frr_process_reqkey';
    } else if (item.frrRequirement?.reqKey) {
      controlId = item.frrRequirement.reqKey;
      strategy = 'frr_req_key';
    } else if (item.ksiIndicator?.indicatorId) {
      controlId = `ksi:${item.ksiIndicator.indicatorId}`;
      strategy = 'ksi_indicator_id';
    } else {
      controlId = item.id;
      strategy = 'checklist_item_id_fallback';
    }

    return {
      projectId,
      checklistItemId: item.id,
      framework: 'frmr',
      controlId,
      linkRequired: false,
      diagnostics: {
        strategy,
        frrRequirementId: item.frrRequirementId || null,
        ksiIndicatorId: item.ksiIndicatorId || null,
        catalogRequirementId: item.catalogRequirementId || null,
      },
    };
  }

  private getEnvProjectKeys() {
    const mapping = new Map<string, string>();
    const raw = this.config.get<string>('INTEGRATION_PROJECT_KEYS');
    if (!raw) return mapping;

    const normalized = raw.trim();
    if (!normalized) return mapping;

    try {
      const parsed = JSON.parse(normalized) as Record<string, string>;
      for (const [projectId, key] of Object.entries(parsed)) {
        if (projectId && key) mapping.set(projectId, String(key));
      }
      return mapping;
    } catch {
      const pairs = normalized.split(',').map((x) => x.trim()).filter(Boolean);
      for (const pair of pairs) {
        const [projectId, key] = pair.split(':');
        if (projectId && key) mapping.set(projectId.trim(), key.trim());
      }
      return mapping;
    }
  }
}

