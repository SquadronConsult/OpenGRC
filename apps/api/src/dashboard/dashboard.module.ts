import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ChecklistItem } from '../entities/checklist-item.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { Project } from '../entities/project.entity';
import { ComplianceSnapshot } from '../entities/compliance-snapshot.entity';
import { EvidenceItem } from '../entities/evidence-item.entity';
import { Risk } from '../entities/risk.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ComplianceSnapshotCronService } from './compliance-snapshot-cron.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      ChecklistItem,
      AuditLog,
      Project,
      ComplianceSnapshot,
      EvidenceItem,
      Risk,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService, ComplianceSnapshotCronService],
  exports: [DashboardService],
})
export class DashboardModule {}
