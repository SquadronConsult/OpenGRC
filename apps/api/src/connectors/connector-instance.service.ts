import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationConnectorInstance } from '../entities/integration-connector-instance.entity';
import { IntegrationConnectorRun } from '../entities/integration-connector-run.entity';
import { ProjectsService } from '../projects/projects.service';
import { ConnectorRegistry } from './connector-registry';
import { ConnectorOrchestratorService } from './connector-orchestrator.service';
import { parseConfigJson, redactObject } from './connector-redact';
import type { CreateConnectorInstanceDto, UpdateConnectorInstanceDto } from './dto/connector-instance.dto';
export { CreateConnectorInstanceDto, UpdateConnectorInstanceDto } from './dto/connector-instance.dto';

@Injectable()
export class ConnectorInstanceService {
  constructor(
    @InjectRepository(IntegrationConnectorInstance)
    private readonly instances: Repository<IntegrationConnectorInstance>,
    @InjectRepository(IntegrationConnectorRun)
    private readonly runs: Repository<IntegrationConnectorRun>,
    private readonly projects: ProjectsService,
    private readonly registry: ConnectorRegistry,
    private readonly orchestrator: ConnectorOrchestratorService,
  ) {}

  listRegistry() {
    return this.registry.listMeta();
  }

  async listInstances(projectId: string, userId: string, role: string) {
    await this.projects.assertAccess(projectId, userId, role);
    return this.listInstancesForProject(projectId);
  }

  /** Same as listInstances but caller already authenticated with project integration key. */
  async listInstancesForIntegration(projectId: string) {
    await this.projects.ensureProjectExists(projectId);
    return this.listInstancesForProject(projectId);
  }

  private async listInstancesForProject(projectId: string) {
    const rows = await this.instances.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => this.serializeInstance(r));
  }

  async getInstance(
    projectId: string,
    instanceId: string,
    userId: string,
    role: string,
  ) {
    await this.projects.assertAccess(projectId, userId, role);
    return this.getInstanceForProject(projectId, instanceId);
  }

  async getInstanceForIntegration(projectId: string, instanceId: string) {
    await this.projects.ensureProjectExists(projectId);
    return this.getInstanceForProject(projectId, instanceId);
  }

  private async getInstanceForProject(projectId: string, instanceId: string) {
    const row = await this.instances.findOne({
      where: { id: instanceId, projectId },
    });
    if (!row) throw new NotFoundException('Connector instance not found');
    return this.serializeInstance(row);
  }

  async createInstance(
    projectId: string,
    dto: CreateConnectorInstanceDto,
    userId: string,
    role: string,
  ) {
    await this.projects.assertAccess(projectId, userId, role);
    return this.createInstanceForProject(projectId, dto);
  }

  async createInstanceForIntegration(
    projectId: string,
    dto: CreateConnectorInstanceDto,
  ) {
    await this.projects.ensureProjectExists(projectId);
    return this.createInstanceForProject(projectId, dto);
  }

  private async createInstanceForProject(
    projectId: string,
    dto: CreateConnectorInstanceDto,
  ) {
    if (!this.registry.get(dto.connectorId)) {
      throw new NotFoundException(`Unknown connector_id: ${dto.connectorId}`);
    }
    const row = await this.instances.save(
      this.instances.create({
        projectId,
        connectorId: dto.connectorId,
        label: dto.label,
        enabled: dto.enabled !== false,
        configJson: JSON.stringify(dto.config || {}),
        linkedCredentialId: null,
        cursor: null,
        lastRunAt: null,
        lastSuccessAt: null,
        lastError: null,
      }),
    );
    return this.serializeInstance(row);
  }

  async updateInstance(
    projectId: string,
    instanceId: string,
    patch: Partial<UpdateConnectorInstanceDto>,
    userId: string,
    role: string,
  ) {
    await this.projects.assertAccess(projectId, userId, role);
    return this.updateInstanceForProject(projectId, instanceId, patch);
  }

  async updateInstanceForIntegration(
    projectId: string,
    instanceId: string,
    patch: Partial<UpdateConnectorInstanceDto>,
  ) {
    await this.projects.ensureProjectExists(projectId);
    return this.updateInstanceForProject(projectId, instanceId, patch);
  }

  private async updateInstanceForProject(
    projectId: string,
    instanceId: string,
    patch: Partial<UpdateConnectorInstanceDto>,
  ) {
    const row = await this.instances.findOne({
      where: { id: instanceId, projectId },
    });
    if (!row) throw new NotFoundException('Connector instance not found');
    if (patch.label !== undefined) row.label = patch.label;
    if (patch.enabled !== undefined) row.enabled = patch.enabled;
    if (patch.config !== undefined) row.configJson = JSON.stringify(patch.config);
    if (patch.cursor !== undefined) row.cursor = patch.cursor;
    await this.instances.save(row);
    return this.serializeInstance(row);
  }

  async deleteInstance(
    projectId: string,
    instanceId: string,
    userId: string,
    role: string,
  ) {
    await this.projects.assertAccess(projectId, userId, role);
    return this.deleteInstanceForProject(projectId, instanceId);
  }

  async deleteInstanceForIntegration(projectId: string, instanceId: string) {
    await this.projects.ensureProjectExists(projectId);
    return this.deleteInstanceForProject(projectId, instanceId);
  }

  private async deleteInstanceForProject(projectId: string, instanceId: string) {
    const row = await this.instances.findOne({
      where: { id: instanceId, projectId },
    });
    if (!row) throw new NotFoundException('Connector instance not found');
    await this.instances.remove(row);
    return { deleted: true, id: instanceId };
  }

  async listRuns(
    projectId: string,
    instanceId: string,
    userId: string,
    role: string,
    limit = 20,
  ) {
    await this.projects.assertAccess(projectId, userId, role);
    return this.listRunsForProject(projectId, instanceId, limit);
  }

  async listRunsForIntegration(
    projectId: string,
    instanceId: string,
    limit = 20,
  ) {
    await this.projects.ensureProjectExists(projectId);
    return this.listRunsForProject(projectId, instanceId, limit);
  }

  private async listRunsForProject(
    projectId: string,
    instanceId: string,
    limit = 20,
  ) {
    const inst = await this.instances.findOne({
      where: { id: instanceId, projectId },
    });
    if (!inst) throw new NotFoundException('Connector instance not found');
    const rows = await this.runs.find({
      where: { instanceId },
      order: { startedAt: 'DESC' },
      take: Math.min(100, Math.max(1, limit)),
    });
    return rows.map((r) => ({
      id: r.id,
      instanceId: r.instanceId,
      status: r.status,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      itemsAccepted: r.itemsAccepted,
      itemsRejected: r.itemsRejected,
      errorMessage: r.errorMessage,
      diagnostics: r.diagnostics,
    }));
  }

  async triggerRun(
    projectId: string,
    instanceId: string,
    userId: string,
    role: string,
  ) {
    await this.projects.assertAccess(projectId, userId, role);
    return this.triggerRunForProject(projectId, instanceId);
  }

  async triggerRunForIntegration(projectId: string, instanceId: string) {
    await this.projects.ensureProjectExists(projectId);
    return this.triggerRunForProject(projectId, instanceId);
  }

  private async triggerRunForProject(projectId: string, instanceId: string) {
    const inst = await this.instances.findOne({
      where: { id: instanceId, projectId },
    });
    if (!inst) throw new NotFoundException('Connector instance not found');
    const run = await this.orchestrator.runInstance(inst.id);
    return {
      runId: run.id,
      status: run.status,
      itemsAccepted: run.itemsAccepted,
      itemsRejected: run.itemsRejected,
      errorMessage: run.errorMessage,
      diagnostics: run.diagnostics,
    };
  }

  /** Project-level summary for banners and MCP. */
  async projectConnectorStatus(projectId: string, userId: string, role: string) {
    await this.projects.assertAccess(projectId, userId, role);
    return this.projectConnectorStatusForProject(projectId);
  }

  async projectConnectorStatusForIntegration(projectId: string) {
    await this.projects.ensureProjectExists(projectId);
    return this.projectConnectorStatusForProject(projectId);
  }

  private async projectConnectorStatusForProject(projectId: string) {
    const rows = await this.instances.find({ where: { projectId } });
    const staleAfterDays = 30;
    const now = Date.now();
    const staleMs = staleAfterDays * 24 * 60 * 60 * 1000;

    const instances = rows.map((r) => {
      const lastOk = r.lastSuccessAt ? new Date(r.lastSuccessAt).getTime() : 0;
      const stale =
        r.enabled &&
        (!lastOk || now - lastOk > staleMs) &&
        r.connectorId !== 'slack_webhook' &&
        r.connectorId !== 'teams_webhook';
      return {
        id: r.id,
        connectorId: r.connectorId,
        label: r.label,
        enabled: r.enabled,
        lastRunAt: r.lastRunAt,
        lastSuccessAt: r.lastSuccessAt,
        lastError: r.lastError,
        staleAutomatedEvidence: stale,
      };
    });

    const anyFailed = instances.some((i) => i.enabled && i.lastError);
    const anyStale = instances.some((i) => i.staleAutomatedEvidence);

    return {
      projectId,
      instances,
      banner: {
        failedConnectors: anyFailed,
        staleAutomatedEvidence: anyStale,
      },
    };
  }

  private serializeInstance(row: IntegrationConnectorInstance) {
    const cfg = parseConfigJson(row.configJson);
    return {
      id: row.id,
      projectId: row.projectId,
      connectorId: row.connectorId,
      label: row.label,
      enabled: row.enabled,
      linkedCredentialId: row.linkedCredentialId,
      config: redactObject(cfg),
      cursor: row.cursor,
      lastRunAt: row.lastRunAt,
      lastSuccessAt: row.lastSuccessAt,
      lastError: row.lastError,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
