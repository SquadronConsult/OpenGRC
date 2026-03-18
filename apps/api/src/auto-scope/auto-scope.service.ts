import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { readdir, readFile, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { Repository } from 'typeorm';
import {
  STSClient,
  GetCallerIdentityCommand,
} from '@aws-sdk/client-sts';
import {
  EC2Client,
  DescribeInstancesCommand,
} from '@aws-sdk/client-ec2';
import {
  LambdaClient,
  ListFunctionsCommand,
} from '@aws-sdk/client-lambda';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import {
  RDSClient,
  DescribeDBInstancesCommand,
} from '@aws-sdk/client-rds';
import {
  ClientSecretCredential,
  DefaultAzureCredential,
  TokenCredential,
} from '@azure/identity';
import { ResourceManagementClient } from '@azure/arm-resources';
import { ComputeManagementClient } from '@azure/arm-compute';
import { GoogleAuth } from 'google-auth-library';
import { InstancesClient } from '@google-cloud/compute';
import { ServiceUsageClient } from '@google-cloud/service-usage';
import { AuditService } from '../audit/audit.service';
import { ChecklistService } from '../checklist/checklist.service';
import { ApplicabilityRecommendation } from '../entities/applicability-recommendation.entity';
import { ChecklistItem } from '../entities/checklist-item.entity';
import { DetectorFinding } from '../entities/detector-finding.entity';
import { Project } from '../entities/project.entity';
import { ReviewDecision } from '../entities/review-decision.entity';
import { SourceSnapshot } from '../entities/source-snapshot.entity';
import { ProjectsService } from '../projects/projects.service';
import { deriveFactsFromSnapshots } from './auto-scope.detectors';
import { evaluateApplicabilityRule } from './auto-scope.rules';
import { AutoScopeRunOptions, DerivedFact } from './auto-scope.types';

const MAX_SCAN_FILES = 2500;
const MAX_SCAN_FILE_SIZE_BYTES = 1024 * 1024; // 1MB
const CONNECTOR_TIMEOUT_MS = 20_000;

type SnapshotResult = {
  sourceType: string;
  status: 'success' | 'error';
  summary?: Record<string, unknown>;
  data?: Record<string, unknown>;
  error?: string;
};

type PreflightCheckStatus = 'pass' | 'warn' | 'fail';

type PreflightCheck = {
  id: string;
  label: string;
  status: PreflightCheckStatus;
  detail: string;
  fix?: string;
};

@Injectable()
export class AutoScopeService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
    @InjectRepository(ChecklistItem)
    private readonly itemRepo: Repository<ChecklistItem>,
    @InjectRepository(SourceSnapshot)
    private readonly snapshotRepo: Repository<SourceSnapshot>,
    @InjectRepository(DetectorFinding)
    private readonly findingRepo: Repository<DetectorFinding>,
    @InjectRepository(ApplicabilityRecommendation)
    private readonly recommendationRepo: Repository<ApplicabilityRecommendation>,
    @InjectRepository(ReviewDecision)
    private readonly reviewDecisionRepo: Repository<ReviewDecision>,
    private readonly projectsService: ProjectsService,
    private readonly checklistService: ChecklistService,
    private readonly audit: AuditService,
  ) {}

  async preflight(
    projectId: string,
    userId: string,
    role: string,
    options: AutoScopeRunOptions = {},
  ) {
    await this.projectsService.assertAccess(projectId, userId, role);
    const project = await this.projectsRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const connectors = {
      repo: options.connectors?.repo !== false,
      iac: options.connectors?.iac !== false,
      aws: options.connectors?.aws !== false,
      azure: options.connectors?.azure !== false,
      gcp: options.connectors?.gcp !== false,
    };
    const inventoryMode =
      options.inventoryMode ||
      ((process.env.AUTO_SCOPE_INVENTORY_MODE as 'metadata' | 'live') || 'metadata');
    const repoPath = options.repoPath ? resolve(options.repoPath) : process.cwd();

    const checks: PreflightCheck[] = [];
    const addCheck = (
      id: string,
      label: string,
      status: PreflightCheckStatus,
      detail: string,
      fix?: string,
    ) => checks.push({ id, label, status, detail, fix });

    const repoOk = await stat(repoPath)
      .then((s) => s.isDirectory())
      .catch(() => false);
    if (repoOk) {
      addCheck(
        'repo_path',
        'Repository path',
        'pass',
        `Path is accessible: ${repoPath}`,
      );
    } else {
      addCheck(
        'repo_path',
        'Repository path',
        'fail',
        `Path is not accessible from API runtime: ${repoPath}`,
        'Set repository path to /workspace for Docker-based API runtime, then retry.',
      );
    }

    const hasAnyConnector =
      connectors.repo ||
      connectors.iac ||
      connectors.aws ||
      connectors.azure ||
      connectors.gcp;
    if (!hasAnyConnector) {
      addCheck(
        'connectors_any',
        'Connector selection',
        'fail',
        'No connectors are enabled.',
        'Enable at least one connector (REPO, IAC, or cloud).',
      );
    } else {
      addCheck(
        'connectors_any',
        'Connector selection',
        'pass',
        'At least one connector is enabled.',
      );
    }

    if (inventoryMode === 'live') {
      if (connectors.aws) {
        try {
          const identity = await this.getAwsIdentity(options);
          if (identity.accountId) {
            addCheck(
              'aws_auth',
              'AWS SDK authentication',
              'pass',
              `Authenticated as AWS account ${identity.accountId}.`,
            );
          } else {
            addCheck(
              'aws_auth',
              'AWS SDK authentication',
              'fail',
              'AWS identity could not be resolved.',
              'Provide AWS credentials (env/profile/role) to the API runtime.',
            );
          }
        } catch (e) {
          addCheck(
            'aws_auth',
            'AWS SDK authentication',
            'fail',
            e instanceof Error ? e.message : 'Unable to validate AWS credentials.',
              'Provide AWS credentials via wizard fields or runtime credential chain.',
          );
        }
      }

      if (connectors.azure) {
        try {
          const azureIdentity = await this.getAzureIdentity(options);
          if (azureIdentity.subscriptionId) {
            addCheck(
              'azure_auth',
              'Azure SDK authentication',
              'pass',
              `Authenticated with Azure subscription ${azureIdentity.subscriptionId}.`,
            );
          } else {
            addCheck(
              'azure_auth',
              'Azure SDK authentication',
              'warn',
              'Authenticated, but no Azure subscription ID was discovered.',
              'Set AZURE_SUBSCRIPTION_ID or provide subscription ID in wizard.',
            );
          }
        } catch (e) {
          addCheck(
            'azure_auth',
            'Azure SDK authentication',
            'fail',
            e instanceof Error ? e.message : 'Unable to validate Azure credentials.',
              'Provide Azure service principal fields in wizard (tenant/client/secret) or runtime credentials.',
          );
        }
      }

      if (connectors.gcp) {
        try {
          const gcpIdentity = await this.getGcpIdentity(options);
          if (gcpIdentity.projectId) {
            addCheck(
              'gcp_auth',
              'GCP SDK authentication',
              'pass',
              `Authenticated with GCP project ${gcpIdentity.projectId}.`,
            );
          } else {
            addCheck(
              'gcp_auth',
              'GCP SDK authentication',
              'warn',
              'Authenticated, but no GCP project was resolved.',
              'Set GCP_PROJECT_ID or provide project ID in wizard.',
            );
          }
        } catch (e) {
          addCheck(
            'gcp_auth',
            'GCP SDK authentication',
            'fail',
            e instanceof Error ? e.message : 'Unable to validate GCP credentials.',
              'Provide GCP service account JSON in wizard or configure ADC in runtime.',
          );
        }
      }
    } else {
      if (connectors.aws) {
        const hasAccountHint = Boolean(
          options.cloud?.aws?.accountId || process.env.AWS_ACCOUNT_ID,
        );
        addCheck(
          'aws_metadata',
          'AWS metadata hint',
          hasAccountHint ? 'pass' : 'warn',
          hasAccountHint
            ? 'AWS account hint is set.'
            : 'AWS account hint is not set.',
          hasAccountHint ? undefined : 'Optionally provide AWS account ID for better scoping confidence.',
        );
      }
      if (connectors.azure) {
        const hasSubHint = Boolean(
          options.cloud?.azure?.subscriptionId || process.env.AZURE_SUBSCRIPTION_ID,
        );
        addCheck(
          'azure_metadata',
          'Azure metadata hint',
          hasSubHint ? 'pass' : 'warn',
          hasSubHint
            ? 'Azure subscription hint is set.'
            : 'Azure subscription hint is not set.',
          hasSubHint ? undefined : 'Optionally provide Azure subscription ID for better scoping confidence.',
        );
      }
      if (connectors.gcp) {
        const hasProjectHint = Boolean(
          options.cloud?.gcp?.projectId || process.env.GCP_PROJECT_ID,
        );
        addCheck(
          'gcp_metadata',
          'GCP metadata hint',
          hasProjectHint ? 'pass' : 'warn',
          hasProjectHint
            ? 'GCP project hint is set.'
            : 'GCP project hint is not set.',
          hasProjectHint ? undefined : 'Optionally provide GCP project ID for better scoping confidence.',
        );
      }
    }

    const failCount = checks.filter((c) => c.status === 'fail').length;
    const warnCount = checks.filter((c) => c.status === 'warn').length;

    return {
      ready: failCount === 0,
      inventoryMode,
      repoPath,
      connectors,
      summary: {
        total: checks.length,
        pass: checks.filter((c) => c.status === 'pass').length,
        warn: warnCount,
        fail: failCount,
      },
      checks,
    };
  }

  async run(
    projectId: string,
    userId: string,
    role: string,
    options: AutoScopeRunOptions = {},
  ) {
    await this.projectsService.assertAccess(projectId, userId, role);
    const project = await this.projectsRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const runId = randomUUID();
    await this.recommendationRepo.update(
      { projectId, status: 'pending_review' },
      { status: 'stale' },
    );

    const connectors = {
      repo: options.connectors?.repo !== false,
      iac: options.connectors?.iac !== false,
      aws: options.connectors?.aws !== false,
      azure: options.connectors?.azure !== false,
      gcp: options.connectors?.gcp !== false,
    };
    const inventoryMode =
      options.inventoryMode ||
      ((process.env.AUTO_SCOPE_INVENTORY_MODE as 'metadata' | 'live') ||
        'metadata');

    const snapshots: SnapshotResult[] = [];
    const repoPath = options.repoPath ? resolve(options.repoPath) : process.cwd();
    let scannedFiles: string[] = [];

    if (connectors.repo || connectors.iac) {
      scannedFiles = await this.scanRepoFiles(repoPath);
    }

    if (connectors.repo) {
      snapshots.push(
        await this.runWithTimeout(
          'repo',
          () => this.repoConnector(repoPath, scannedFiles),
          CONNECTOR_TIMEOUT_MS,
        ),
      );
    }
    if (connectors.iac) {
      snapshots.push(
        await this.runWithTimeout(
          'iac',
          () => this.iacConnector(scannedFiles),
          CONNECTOR_TIMEOUT_MS,
        ),
      );
    }
    if (connectors.aws) {
      snapshots.push(
        await this.runWithTimeout(
          'aws',
          () => this.awsConnector(options, inventoryMode),
          CONNECTOR_TIMEOUT_MS,
        ),
      );
    }
    if (connectors.azure) {
      snapshots.push(
        await this.runWithTimeout(
          'azure',
          () => this.azureConnector(options, inventoryMode),
          CONNECTOR_TIMEOUT_MS,
        ),
      );
    }
    if (connectors.gcp) {
      snapshots.push(
        await this.runWithTimeout(
          'gcp',
          () => this.gcpConnector(options, inventoryMode),
          CONNECTOR_TIMEOUT_MS,
        ),
      );
    }

    for (const s of snapshots) {
      await this.snapshotRepo.save(
        this.snapshotRepo.create({
          projectId,
          runId,
          sourceType: s.sourceType,
          status: s.status,
          summary: s.summary || null,
          data: s.data || null,
          error: s.error || null,
        }),
      );
    }

    const facts = deriveFactsFromSnapshots(snapshots);
    await this.persistFacts(projectId, runId, facts);
    const factMap = this.toFactMap(facts);

    let checklist = await this.itemRepo.find({
      where: { projectId },
      relations: ['frrRequirement', 'ksiIndicator'],
    });
    if (!checklist.length) {
      await this.checklistService.generateChecklist(projectId, true);
      checklist = await this.itemRepo.find({
        where: { projectId },
        relations: ['frrRequirement', 'ksiIndicator'],
      });
    }

    let created = 0;
    const decisionCounts: Record<string, number> = {
      applicable: 0,
      not_applicable: 0,
      inherited: 0,
    };
    for (const item of checklist) {
      const evaluation = evaluateApplicabilityRule(item, factMap);
      await this.recommendationRepo.save(
        this.recommendationRepo.create({
          projectId,
          runId,
          checklistItemId: item.id,
          decision: evaluation.decision,
          status: 'pending_review',
          ruleId: evaluation.ruleId,
          confidence: evaluation.confidence,
          rationale: evaluation.rationale,
          matchedFacts: evaluation.matchedFacts,
          explainability: evaluation.explainability,
        }),
      );
      created++;
      decisionCounts[evaluation.decision] =
        (decisionCounts[evaluation.decision] || 0) + 1;
    }

    project.autoScopeConfig = {
      repoPath,
      inventoryMode,
      connectors,
      cloud: {
        aws: { accountId: options.cloud?.aws?.accountId || process.env.AWS_ACCOUNT_ID || null },
        azure: {
          subscriptionId:
            options.cloud?.azure?.subscriptionId ||
            process.env.AZURE_SUBSCRIPTION_ID ||
            null,
        },
        gcp: { projectId: options.cloud?.gcp?.projectId || process.env.GCP_PROJECT_ID || null },
      },
    };
    project.autoScopeLastRunAt = new Date();
    await this.projectsRepo.save(project);

    await this.audit.log(
      userId,
      'autoscope.run',
      'project',
      projectId,
      {
        runId,
        connectors,
        inventoryMode,
        generatedRecommendations: created,
        decisionCounts,
      },
    );

    return {
      runId,
      projectId,
      generatedRecommendations: created,
      decisionCounts,
      facts: facts.length,
      snapshotSummary: snapshots.map((s) => ({
        sourceType: s.sourceType,
        status: s.status,
        summary: s.summary || null,
        error: s.error || null,
      })),
    };
  }

  async listRecommendations(
    projectId: string,
    userId: string,
    role: string,
    query: { status?: string; decision?: string; runId?: string; minConfidence?: number },
  ) {
    await this.projectsService.assertAccess(projectId, userId, role);
    const qb = this.recommendationRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.checklistItem', 'item')
      .leftJoinAndSelect('item.frrRequirement', 'frr')
      .leftJoinAndSelect('item.ksiIndicator', 'ksi')
      .where('r.project_id = :projectId', { projectId });

    if (query.status) qb.andWhere('r.status = :status', { status: query.status });
    if (query.decision) qb.andWhere('r.decision = :decision', { decision: query.decision });
    if (query.runId) qb.andWhere('r.run_id = :runId', { runId: query.runId });
    if (query.minConfidence != null)
      qb.andWhere('r.confidence >= :minConfidence', {
        minConfidence: query.minConfidence,
      });

    const items = await qb.orderBy('r.created_at', 'DESC').getMany();
    return {
      items,
      total: items.length,
    };
  }

  async approveRecommendation(
    projectId: string,
    recommendationId: string,
    userId: string,
    role: string,
    notes?: string,
  ) {
    await this.projectsService.assertAccess(projectId, userId, role);
    const recommendation = await this.recommendationRepo.findOne({
      where: { id: recommendationId, projectId },
      relations: ['checklistItem'],
    });
    if (!recommendation) throw new NotFoundException('Recommendation not found');
    if (recommendation.status === 'stale') {
      throw new BadRequestException('Stale recommendations cannot be approved');
    }

    recommendation.status = 'approved';
    recommendation.appliedAt = new Date();
    await this.recommendationRepo.save(recommendation);

    const item = recommendation.checklistItem;
    item.reviewState = 'scoped_approved';
    item.applicabilityDecision = recommendation.decision;
    item.applicabilityRationale = recommendation.rationale;
    item.applicabilityConfidence = recommendation.confidence;
    item.applicabilitySource = `auto_scope:${recommendation.ruleId}`;
    await this.itemRepo.save(item);

    await this.reviewDecisionRepo.save(
      this.reviewDecisionRepo.create({
        projectId,
        recommendationId: recommendation.id,
        reviewerId: userId,
        decision: 'approved',
        notes: notes || null,
      }),
    );

    await this.audit.log(
      userId,
      'autoscope.recommendation.approve',
      'applicability_recommendation',
      recommendation.id,
      {
        decision: recommendation.decision,
        ruleId: recommendation.ruleId,
        checklistItemId: recommendation.checklistItemId,
      },
    );

    return recommendation;
  }

  async rejectRecommendation(
    projectId: string,
    recommendationId: string,
    userId: string,
    role: string,
    notes?: string,
  ) {
    await this.projectsService.assertAccess(projectId, userId, role);
    const recommendation = await this.recommendationRepo.findOne({
      where: { id: recommendationId, projectId },
      relations: ['checklistItem'],
    });
    if (!recommendation) throw new NotFoundException('Recommendation not found');
    if (recommendation.status === 'stale') {
      throw new BadRequestException('Stale recommendations cannot be rejected');
    }

    recommendation.status = 'rejected';
    await this.recommendationRepo.save(recommendation);

    const item = recommendation.checklistItem;
    item.reviewState = 'scoped_rejected';
    await this.itemRepo.save(item);

    await this.reviewDecisionRepo.save(
      this.reviewDecisionRepo.create({
        projectId,
        recommendationId: recommendation.id,
        reviewerId: userId,
        decision: 'rejected',
        notes: notes || null,
      }),
    );

    await this.audit.log(
      userId,
      'autoscope.recommendation.reject',
      'applicability_recommendation',
      recommendation.id,
      {
        decision: recommendation.decision,
        ruleId: recommendation.ruleId,
        checklistItemId: recommendation.checklistItemId,
      },
    );

    return recommendation;
  }

  async bulkApprove(
    projectId: string,
    recommendationIds: string[],
    userId: string,
    role: string,
    notes?: string,
  ) {
    const results: ApplicabilityRecommendation[] = [];
    for (const id of recommendationIds) {
      results.push(await this.approveRecommendation(projectId, id, userId, role, notes));
    }
    return {
      approved: results.length,
      items: results,
    };
  }

  private async persistFacts(projectId: string, runId: string, facts: DerivedFact[]) {
    for (const fact of facts) {
      await this.findingRepo.save(
        this.findingRepo.create({
          projectId,
          runId,
          source: fact.source,
          key: fact.key,
          valueType: fact.valueType,
          value: fact.value,
          strength: fact.strength,
          rationale: fact.rationale || null,
        }),
      );
    }
  }

  private toFactMap(facts: DerivedFact[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const f of facts) {
      out[f.key] = f.value;
    }
    return out;
  }

  private async runWithTimeout(
    sourceType: string,
    task: () => Promise<Omit<SnapshotResult, 'sourceType'>>,
    timeoutMs: number,
  ): Promise<SnapshotResult> {
    try {
      const result = await Promise.race([
        task(),
        new Promise<Omit<SnapshotResult, 'sourceType'>>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Connector timed out after ${timeoutMs}ms`)),
            timeoutMs,
          ),
        ),
      ]);
      return {
        sourceType,
        status: result.status || 'success',
        data: result.data || {},
        summary: result.summary || {},
      };
    } catch (e) {
      return {
        sourceType,
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  private async scanRepoFiles(rootPath: string) {
    const files: string[] = [];
    const stack = [rootPath];
    const blocked = new Set([
      'node_modules',
      '.git',
      '.next',
      'dist',
      'build',
      'coverage',
      '.cursor',
      '.vscode',
    ]);

    while (stack.length > 0 && files.length < MAX_SCAN_FILES) {
      const dir = stack.pop() as string;
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (files.length >= MAX_SCAN_FILES) break;
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!blocked.has(entry.name)) stack.push(fullPath);
          continue;
        }
        if (!entry.isFile()) continue;
        const info = await stat(fullPath).catch(() => null);
        if (!info || info.size > MAX_SCAN_FILE_SIZE_BYTES) continue;
        files.push(fullPath);
      }
    }

    return files;
  }

  private async repoConnector(repoPath: string, files: string[]) {
    const lower = files.map((f) => f.toLowerCase());
    const detected: string[] = [];

    if (lower.some((f) => f.endsWith('dockerfile') || f.includes('docker-compose'))) {
      detected.push('docker');
    }
    if (lower.some((f) => f.includes('.github/workflows') || f.includes('.gitlab-ci'))) {
      detected.push('ci');
    }
    if (lower.some((f) => f.includes('openapi') || f.endsWith('swagger.json'))) {
      detected.push('openapi');
    }
    if (lower.some((f) => f.includes('nestjs') || f.includes('/src/main.ts'))) {
      detected.push('nestjs');
    }

    return {
      status: 'success' as const,
      summary: {
        repoPath,
        scannedFiles: files.length,
      },
      data: {
        detected,
      },
    };
  }

  private async iacConnector(files: string[]) {
    let terraformFiles = 0;
    let cloudFormationFiles = 0;
    let kubernetesFiles = 0;
    const providers = new Set<string>();

    for (const file of files) {
      const lc = file.toLowerCase();
      if (lc.endsWith('.tf')) {
        terraformFiles++;
        providers.add('terraform');
        const content = (await readFile(file, 'utf8').catch(() => '')).toLowerCase();
        if (content.includes('provider "aws"') || content.includes('aws_')) providers.add('aws');
        if (content.includes('provider "azurerm"') || content.includes('azurerm_')) providers.add('azure');
        if (content.includes('provider "google"') || content.includes('google_')) providers.add('gcp');
        if (content.includes('kubernetes_')) providers.add('kubernetes');
      }

      if (
        lc.endsWith('.yaml') ||
        lc.endsWith('.yml') ||
        lc.endsWith('.json')
      ) {
        const content = (await readFile(file, 'utf8').catch(() => '')).toLowerCase();
        if (content.includes('awstemplateformatversion') || content.includes('resources:')) {
          if (lc.includes('cloudformation') || content.includes('awstemplateformatversion')) {
            cloudFormationFiles++;
            providers.add('aws');
          }
        }
        if (content.includes('kind: deployment') || content.includes('apiversion: apps/v1')) {
          kubernetesFiles++;
          providers.add('kubernetes');
        }
      }
    }

    return {
      status: 'success' as const,
      summary: {
        scannedFiles: files.length,
        terraformFiles,
        cloudFormationFiles,
        kubernetesFiles,
      },
      data: {
        providers: Array.from(providers),
      },
    };
  }

  private async awsConnector(
    options: AutoScopeRunOptions,
    inventoryMode: 'metadata' | 'live',
  ) {
    const accountId = options.cloud?.aws?.accountId || process.env.AWS_ACCOUNT_ID || null;
    const regions = options.cloud?.aws?.regions || (process.env.AWS_REGIONS?.split(',').map((x) => x.trim()).filter(Boolean) || []);
    const explicitAwsCreds = this.getAwsSdkCredentials(options);
    const hasCreds = Boolean(
      explicitAwsCreds ||
        process.env.AWS_ACCESS_KEY_ID ||
        process.env.AWS_PROFILE ||
        process.env.AWS_WEB_IDENTITY_TOKEN_FILE,
    );
    if (inventoryMode !== 'live') {
      return {
        status: 'success' as const,
        summary: {
          mode: 'metadata',
          configured: Boolean(accountId),
          regions: regions.length,
          hasCredentials: hasCreds,
        },
        data: {
          accountId,
          regions,
        },
      };
    }

    const warnings: string[] = [];
    let resolvedAccountId = String(accountId || '');
    try {
      const identity = await this.getAwsIdentity(options);
      if (identity.accountId) {
        resolvedAccountId = identity.accountId;
      }
    } catch (e) {
      warnings.push(`aws identity: ${e instanceof Error ? e.message : String(e)}`);
    }

    const chosenRegion =
      regions[0] || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

    const sdkCredentials = this.getAwsSdkCredentials(options);
    const ec2Client = new EC2Client({ region: chosenRegion, credentials: sdkCredentials });
    const lambdaClient = new LambdaClient({ region: chosenRegion, credentials: sdkCredentials });
    const s3Client = new S3Client({ region: chosenRegion, credentials: sdkCredentials });
    const rdsClient = new RDSClient({ region: chosenRegion, credentials: sdkCredentials });

    let ec2Count = 0;
    let lambdaCount = 0;
    let bucketCount = 0;
    let rdsCount = 0;

    try {
      const ec2 = await ec2Client.send(new DescribeInstancesCommand({ MaxResults: 1000 }));
      const reservations = Array.isArray(ec2.Reservations) ? ec2.Reservations : [];
      ec2Count = reservations.reduce(
        (acc, r) => acc + (Array.isArray(r.Instances) ? r.Instances.length : 0),
        0,
      );
    } catch (e) {
      warnings.push(`aws ec2: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      const lambdas = await lambdaClient.send(new ListFunctionsCommand({ MaxItems: 1000 }));
      lambdaCount = Array.isArray(lambdas.Functions) ? lambdas.Functions.length : 0;
    } catch (e) {
      warnings.push(`aws lambda: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      const buckets = await s3Client.send(new ListBucketsCommand({}));
      bucketCount = Array.isArray(buckets.Buckets) ? buckets.Buckets.length : 0;
    } catch (e) {
      warnings.push(`aws s3: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      const rds = await rdsClient.send(new DescribeDBInstancesCommand({ MaxRecords: 100 }));
      rdsCount = Array.isArray(rds.DBInstances) ? rds.DBInstances.length : 0;
    } catch (e) {
      warnings.push(`aws rds: ${e instanceof Error ? e.message : String(e)}`);
    }

    return {
      status: 'success' as const,
      summary: {
        mode: 'live',
        configured: Boolean(resolvedAccountId),
        regions: regions.length,
        hasCredentials: hasCreds,
        ec2Instances: ec2Count,
        lambdaFunctions: lambdaCount,
        s3Buckets: bucketCount,
        rdsInstances: rdsCount,
        warnings,
      },
      data: {
        accountId: resolvedAccountId || accountId,
        regions,
        resources: {
          ec2Instances: ec2Count,
          lambdaFunctions: lambdaCount,
          s3Buckets: bucketCount,
          rdsInstances: rdsCount,
        },
      },
    };
  }

  private async azureConnector(
    options: AutoScopeRunOptions,
    inventoryMode: 'metadata' | 'live',
  ) {
    const subscriptionId =
      options.cloud?.azure?.subscriptionId ||
      process.env.AZURE_SUBSCRIPTION_ID ||
      null;
    const tenantId =
      options.cloud?.azure?.tenantId || process.env.AZURE_TENANT_ID || null;
    const hasCreds = Boolean(
      process.env.AZURE_CLIENT_ID &&
        process.env.AZURE_CLIENT_SECRET &&
        process.env.AZURE_TENANT_ID,
    );
    if (inventoryMode !== 'live') {
      return {
        status: 'success' as const,
        summary: {
          mode: 'metadata',
          configured: Boolean(subscriptionId),
          hasCredentials: hasCreds,
        },
        data: {
          subscriptionId,
          tenantId,
        },
      };
    }

    const warnings: string[] = [];
    let subId = String(subscriptionId || '');
    let tenant = String(tenantId || '');
    let resourceCount = 0;
    let vmCount = 0;
    try {
      const identity = await this.getAzureIdentity(options);
      subId = String(identity.subscriptionId || subId || '');
      tenant = String(identity.tenantId || tenant || '');
      if (subId) {
        const credential = identity.credential;
        const resourcesClient = new ResourceManagementClient(credential, subId);
        const computeClient = new ComputeManagementClient(credential, subId);

        for await (const _resource of resourcesClient.resources.list()) {
          resourceCount++;
          if (resourceCount >= 2000) break;
        }
        for await (const _vm of computeClient.virtualMachines.listAll()) {
          vmCount++;
          if (vmCount >= 2000) break;
        }
      } else {
        warnings.push('No Azure subscription ID available for live inventory.');
      }
    } catch (e) {
      warnings.push(`azure sdk: ${e instanceof Error ? e.message : String(e)}`);
    }

    return {
      status: 'success' as const,
      summary: {
        mode: 'live',
        configured: Boolean(subId),
        hasCredentials: hasCreds,
        resources: resourceCount,
        virtualMachines: vmCount,
        warnings,
      },
      data: {
        subscriptionId: subId || subscriptionId,
        tenantId: tenant || tenantId,
        resources: {
          total: resourceCount,
          virtualMachines: vmCount,
        },
      },
    };
  }

  private async gcpConnector(
    options: AutoScopeRunOptions,
    inventoryMode: 'metadata' | 'live',
  ) {
    const projectId =
      options.cloud?.gcp?.projectId || process.env.GCP_PROJECT_ID || null;
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || null;
    if (inventoryMode !== 'live') {
      return {
        status: 'success' as const,
        summary: {
          mode: 'metadata',
          configured: Boolean(projectId),
          hasCredentials: Boolean(credentialsPath),
        },
        data: {
          projectId,
        },
      };
    }

    const warnings: string[] = [];
    let activeProject = String(projectId || '');
    let enabledServices = 0;
    let instanceCount = 0;
    try {
      const gcp = await this.getGcpIdentity(options);
      activeProject = String(gcp.projectId || activeProject || '');
      if (activeProject) {
        const serviceUsage = new ServiceUsageClient();
        const parent = `projects/${activeProject}`;
        for await (const _svc of serviceUsage.listServicesAsync({
          parent,
          filter: 'state:ENABLED',
        })) {
          enabledServices++;
          if (enabledServices >= 3000) break;
        }

        const instancesClient = new InstancesClient();
        for await (const [, scoped] of instancesClient.aggregatedListAsync({
          project: activeProject,
        })) {
          const scopedInstances =
            scoped && Array.isArray(scoped.instances) ? scoped.instances.length : 0;
          instanceCount += scopedInstances;
          if (instanceCount >= 5000) break;
        }
      } else {
        warnings.push('No GCP project ID available for live inventory.');
      }
    } catch (e) {
      warnings.push(`gcp sdk: ${e instanceof Error ? e.message : String(e)}`);
    }

    return {
      status: 'success' as const,
      summary: {
        mode: 'live',
        configured: Boolean(activeProject),
        hasCredentials: Boolean(credentialsPath),
        enabledServices,
        computeInstances: instanceCount,
        warnings,
      },
      data: {
        projectId: activeProject || projectId,
        resources: {
          enabledServices,
          computeInstances: instanceCount,
        },
      },
    };
  }

  private async getAwsIdentity(options?: AutoScopeRunOptions) {
    const region =
      process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
    const credentials = this.getAwsSdkCredentials(options);
    const sts = new STSClient({ region, credentials });
    const identity = await sts.send(new GetCallerIdentityCommand({}));
    return {
      accountId: identity.Account || null,
      arn: identity.Arn || null,
      userId: identity.UserId || null,
    };
  }

  private async getAzureIdentity(options: AutoScopeRunOptions) {
    const explicitTenantId =
      options.cloud?.azure?.tenantId || process.env.AZURE_TENANT_ID || null;
    const explicitClientId =
      options.cloud?.azure?.clientId || process.env.AZURE_CLIENT_ID || null;
    const explicitClientSecret =
      options.cloud?.azure?.clientSecret || process.env.AZURE_CLIENT_SECRET || null;

    let credential: TokenCredential;
    if (explicitTenantId && explicitClientId && explicitClientSecret) {
      credential = new ClientSecretCredential(
        explicitTenantId,
        explicitClientId,
        explicitClientSecret,
      );
    } else {
      credential = new DefaultAzureCredential();
    }
    await credential.getToken('https://management.azure.com/.default');
    const subscriptionId =
      options.cloud?.azure?.subscriptionId ||
      process.env.AZURE_SUBSCRIPTION_ID ||
      null;
    const tenantId =
      options.cloud?.azure?.tenantId || process.env.AZURE_TENANT_ID || null;
    return {
      credential,
      subscriptionId,
      tenantId,
    };
  }

  private async getGcpIdentity(options: AutoScopeRunOptions) {
    const explicitServiceAccount = this.parseServiceAccountJson(
      options.cloud?.gcp?.serviceAccountJson,
    );
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      credentials: explicitServiceAccount || undefined,
    });
    try {
      await auth.getClient();
    } catch (e) {
      throw new Error(
        `GCP authentication failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    const projectId =
      options.cloud?.gcp?.projectId ||
      process.env.GCP_PROJECT_ID ||
      (await auth.getProjectId().catch(() => null));
    return {
      auth,
      projectId: projectId || null,
    };
  }

  private getAwsSdkCredentials(options?: AutoScopeRunOptions) {
    const accessKeyId = options?.cloud?.aws?.accessKeyId;
    const secretAccessKey = options?.cloud?.aws?.secretAccessKey;
    const sessionToken = options?.cloud?.aws?.sessionToken;
    if (!accessKeyId || !secretAccessKey) return undefined;
    return {
      accessKeyId,
      secretAccessKey,
      sessionToken: sessionToken || undefined,
    };
  }

  private parseServiceAccountJson(raw?: string) {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return parsed;
    } catch {
      return null;
    }
  }
}
