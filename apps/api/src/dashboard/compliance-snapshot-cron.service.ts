import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { DashboardService } from './dashboard.service';

@Injectable()
export class ComplianceSnapshotCronService {
  private readonly log = new Logger(ComplianceSnapshotCronService.name);
  private running = false;

  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    private readonly dashboard: DashboardService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async dailySnapshots() {
    if (process.env.COMPLIANCE_SNAPSHOT_CRON === 'false') return;
    if (this.running) return;
    this.running = true;
    try {
      const all = await this.projects.find();
      let prevReadiness: Record<string, number> = {};
      for (const p of all) {
        const before = await this.dashboard.getStats(p.id);
        prevReadiness[p.id] = before.readinessPct;
      }
      for (const p of all) {
        await this.dashboard.captureSnapshotForProject(p.id);
        const after = await this.dashboard.getStats(p.id);
        const prev = prevReadiness[p.id] ?? after.readinessPct;
        if (prev - after.readinessPct > 5 && p.ownerId) {
          this.log.warn(
            `Compliance drift project=${p.id} ${prev}% -> ${after.readinessPct}% (notify owner ${p.ownerId})`,
          );
        }
      }
    } catch (e) {
      this.log.warn(`Compliance snapshot cron: ${e}`);
    } finally {
      this.running = false;
    }
  }
}
