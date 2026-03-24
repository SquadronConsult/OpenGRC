import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ChecklistItem } from '../entities/checklist-item.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { Project } from '../entities/project.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([ChecklistItem, AuditLog, Project]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
