import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationConnectorInstance } from '../entities/integration-connector-instance.entity';
import { ConnectorOrchestratorService } from './connector-orchestrator.service';
import { parseConfigJson } from './connector-redact';

@Injectable()
export class ConnectorSchedulerService {
  private readonly log = new Logger(ConnectorSchedulerService.name);
  private running = false;

  constructor(
    @InjectRepository(IntegrationConnectorInstance)
    private readonly instances: Repository<IntegrationConnectorInstance>,
    private readonly orchestrator: ConnectorOrchestratorService,
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
        const cfg = parseConfigJson(inst.configJson);
        const pollMin = Number(cfg.pollIntervalMinutes ?? cfg.poll_interval_minutes ?? 60);
        const intervalMs = Math.max(5, pollMin) * 60 * 1000;
        const last = inst.lastRunAt ? new Date(inst.lastRunAt).getTime() : 0;
        if (last && now - last < intervalMs) continue;

        this.log.debug(`Scheduled connector run ${inst.id} (${inst.connectorId})`);
        await this.orchestrator.runInstance(inst.id).catch((e) => {
          this.log.warn(`Scheduled run failed for ${inst.id}: ${e}`);
        });
      }
    } finally {
      this.running = false;
    }
  }
}
