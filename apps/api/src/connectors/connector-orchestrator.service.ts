import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { IntegrationConnectorInstance } from '../entities/integration-connector-instance.entity';
import { IntegrationConnectorRun } from '../entities/integration-connector-run.entity';
import { IntegrationEvidenceService } from '../integrations/integration-evidence.service';
import type { EvidenceUpsertItemDto } from '../integrations/dto/integration-v1.dto';
import { ConnectorRegistry } from './connector-registry';
import type { ConnectorEvidenceRecord } from './connector.types';
import { parseConfigJson } from './connector-redact';

@Injectable()
export class ConnectorOrchestratorService {
  private readonly log = new Logger(ConnectorOrchestratorService.name);

  constructor(
    @InjectRepository(IntegrationConnectorInstance)
    private readonly instances: Repository<IntegrationConnectorInstance>,
    @InjectRepository(IntegrationConnectorRun)
    private readonly runs: Repository<IntegrationConnectorRun>,
    private readonly registry: ConnectorRegistry,
    private readonly evidence: IntegrationEvidenceService,
  ) {}

  private recordToDto(rec: ConnectorEvidenceRecord): EvidenceUpsertItemDto {
    return {
      checklistItemId: rec.checklistItemId,
      framework: rec.framework || 'frmr',
      controlId: rec.controlId,
      evidenceType: rec.evidenceType,
      externalUri: rec.externalUri,
      sourceRunId: rec.sourceRunId,
      occurredAt: rec.occurredAt,
      sourceConnector: rec.sourceConnector,
      metadata: rec.metadata,
      assertion: rec.assertion,
      artifactType: rec.artifactType,
      sourceSystem: rec.sourceSystem,
      collectionStart: rec.collectionStart,
      collectionEnd: rec.collectionEnd,
    };
  }

  /**
   * Execute a collection run for one connector instance (manual or scheduled).
   */
  async runInstance(instanceId: string): Promise<IntegrationConnectorRun> {
    const inst = await this.instances.findOne({ where: { id: instanceId } });
    if (!inst) throw new NotFoundException('Connector instance not found');

    const impl = this.registry.get(inst.connectorId);
    if (!impl) {
      inst.lastError = `Unknown connector_id: ${inst.connectorId}`;
      inst.lastRunAt = new Date();
      await this.instances.save(inst);
      const failed = await this.runs.save(
        this.runs.create({
          instanceId: inst.id,
          status: 'failed',
          startedAt: new Date(),
          finishedAt: new Date(),
          itemsAccepted: 0,
          itemsRejected: 0,
          errorMessage: inst.lastError,
          diagnostics: { connectorId: inst.connectorId },
        }),
      );
      return failed;
    }

    const runId = randomUUID();
    const run = await this.runs.save(
      this.runs.create({
        instanceId: inst.id,
        status: 'running',
        startedAt: new Date(),
        finishedAt: null,
        itemsAccepted: 0,
        itemsRejected: 0,
        errorMessage: null,
        diagnostics: null,
      }),
    );

    const config = parseConfigJson(inst.configJson);
    const cursor = inst.cursor;

    try {
      const result = await impl.collect({
        projectId: inst.projectId,
        instanceId: inst.id,
        runId,
        connectorId: inst.connectorId,
        config,
        cursor,
      });

      const dtos = result.items.map((rec) => this.recordToDto(rec));
      const ingest = await this.evidence.ingestConnectorItems(inst.projectId, dtos);

      const nextCursor =
        result.nextCursor !== undefined ? result.nextCursor : null;
      if (nextCursor !== null && nextCursor !== undefined) {
        inst.cursor = nextCursor === '' ? null : String(nextCursor);
      }

      inst.lastRunAt = new Date();
      inst.lastError = null;
      inst.lastSuccessAt = new Date();
      await this.instances.save(inst);

      run.status = 'success';
      run.finishedAt = new Date();
      run.itemsAccepted = ingest.accepted.length;
      run.itemsRejected = ingest.rejected.length;
      run.diagnostics = {
        ...result.diagnostics,
        rejected: ingest.rejected,
      } as Record<string, unknown>;
      if (ingest.rejected.length > 0) {
        run.errorMessage = `${ingest.rejected.length} item(s) failed ingestion`;
      }
      await this.runs.save(run);

      return run;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.log.warn(`Connector run failed: ${message}`);
      inst.lastRunAt = new Date();
      inst.lastError = message;
      await this.instances.save(inst);

      run.status = 'failed';
      run.finishedAt = new Date();
      run.errorMessage = message;
      await this.runs.save(run);
      return run;
    }
  }
}
