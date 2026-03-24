import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationConnectorInstance } from '../entities/integration-connector-instance.entity';
import { EvidenceItem } from '../entities/evidence-item.entity';
import { ConnectorOrchestratorService } from './connector-orchestrator.service';
import { ConnectorConfigCryptoService } from './connector-config-crypto.service';

@Injectable()
export class ConnectorSchedulerService {
  private readonly log = new Logger(ConnectorSchedulerService.name);
  private running = false;

  constructor(
    @InjectRepository(IntegrationConnectorInstance)
    private readonly instances: Repository<IntegrationConnectorInstance>,
    @InjectRepository(EvidenceItem)
    private readonly evidence: Repository<EvidenceItem>,
    private readonly orchestrator: ConnectorOrchestratorService,
    private readonly configCrypto: ConnectorConfigCryptoService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    if (this.running) return;
    if (process.env.CONNECTOR_SCHEDULER === 'false') return;
    this.running = true;
    try {
      const enabled = await this.instances.find({ where: { enabled: true } });
      const now = Date.now();
      for (const inst of enabled) {
        const cfg = this.configCrypto.decryptConfigJson(inst.configJson);
        const pollMin = Number(cfg.pollIntervalMinutes ?? cfg.poll_interval_minutes ?? 60);
        const intervalMs = Math.max(5, pollMin) * 60 * 1000;
        const last = inst.lastRunAt ? new Date(inst.lastRunAt).getTime() : 0;
        if (last && now - last < intervalMs) continue;

        this.log.debug(`Scheduled connector run ${inst.id} (${inst.connectorId})`);
        await this.orchestrator.runInstance(inst.id).catch((e) => {
          this.log.warn(`Scheduled run failed for ${inst.id}: ${e}`);
        });
      }

      for (const inst of enabled.filter((i) => i.recollectionEnabled)) {
        const days = inst.recollectionIntervalDays ?? 7;
        const horizon = new Date(now + days * 86400000);
        const count = await this.evidence
          .createQueryBuilder('e')
          .innerJoin('e.checklistItem', 'ci')
          .where('ci.projectId = :pid', { pid: inst.projectId })
          .andWhere('e.sourceConnector = :sc', { sc: inst.connectorId })
          .andWhere('e.supersededById IS NULL')
          .andWhere('e.expiresAt IS NOT NULL')
          .andWhere('e.expiresAt <= :h', { h: horizon })
          .getCount();
        if (count === 0) continue;
        const last = inst.lastRunAt ? new Date(inst.lastRunAt).getTime() : 0;
        if (last && now - last < 5 * 60 * 1000) continue;
        this.log.debug(`Evidence recollection for connector instance ${inst.id}`);
        await this.orchestrator.runInstance(inst.id).catch((e) => {
          this.log.warn(`Recollection run failed for ${inst.id}: ${e}`);
        });
      }
    } finally {
      this.running = false;
    }
  }
}
