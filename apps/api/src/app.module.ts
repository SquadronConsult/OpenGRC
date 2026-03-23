import { Module, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { User } from './entities/user.entity';
import { FrmrVersion } from './entities/frmr-version.entity';
import { FrdTerm } from './entities/frd-term.entity';
import { FrrRequirement } from './entities/frr-requirement.entity';
import { KsiIndicator } from './entities/ksi-indicator.entity';
import { Project } from './entities/project.entity';
import { ProjectMember } from './entities/project-member.entity';
import { ChecklistItem } from './entities/checklist-item.entity';
import { EvidenceItem } from './entities/evidence-item.entity';
import { Finding } from './entities/finding.entity';
import { AuditLog } from './entities/audit-log.entity';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { Notification } from './entities/notification.entity';
import { Comment } from './entities/comment.entity';
import { HealthController } from './health/health.controller';
import { AuthService } from './auth/auth.service';
import { RolesGuard } from './auth/roles.guard';
import { FrmrController } from './frmr/frmr.controller';
import { FrmrParserService } from './frmr/frmr-parser.service';
import { FrmrIngestionService } from './frmr/frmr-ingestion.service';
import { ProjectsController } from './projects/projects.controller';
import { ProjectsService } from './projects/projects.service';
import { ChecklistService } from './checklist/checklist.service';
import { ChecklistItemsController } from './checklist/checklist-items.controller';
import { EvidenceController } from './evidence/evidence.controller';
import { FindingsController } from './findings/findings.controller';
import { CommentsController } from './comments/comments.controller';
import { IntegrationsController } from './integrations/integrations.controller';
import { IntegrationEvidenceService } from './integrations/integration-evidence.service';
import { WebhooksController } from './webhooks/webhooks.controller';
import { WebhooksService } from './webhooks/webhooks.service';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsService } from './notifications/notifications.service';
import { StorageService } from './storage/storage.service';
import { ExportService } from './export/export.service';
import { AuditService } from './audit/audit.service';
import { entities } from './db/entities';
import { AutoScopeController } from './auto-scope/auto-scope.controller';
import { AutoScopeService } from './auto-scope/auto-scope.service';

function resolveSqlitePath(): string {
  const explicit = process.env.SQLITE_PATH;
  if (explicit) return explicit;
  const dataDir = process.env.LOCAL_DATA_DIR || process.cwd();
  return join(dataDir, 'grc.sqlite');
}

function buildTypeOrmConfig() {
  const dbType = process.env.DB_TYPE || 'sqlite';
  if (dbType === 'postgres') {
    return {
      type: 'postgres' as const,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'grc',
      password: process.env.DB_PASSWORD || 'grc',
      database: process.env.DB_NAME || 'grc',
      entities,
      synchronize: process.env.DB_SYNC !== 'false',
      logging: process.env.DB_LOG === 'true',
    };
  }

  return {
    type: 'sqlite' as const,
    database: resolveSqlitePath(),
    entities,
    synchronize: process.env.DB_SYNC !== 'false',
    logging: process.env.DB_LOG === 'true',
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot(buildTypeOrmConfig()),
    TypeOrmModule.forFeature(entities),
  ],
  controllers: [
    HealthController,
    FrmrController,
    ProjectsController,
    ChecklistItemsController,
    EvidenceController,
    FindingsController,
    CommentsController,
    IntegrationsController,
    WebhooksController,
    NotificationsController,
    AutoScopeController,
  ],
  providers: [
    AuthService,
    RolesGuard,
    FrmrParserService,
    FrmrIngestionService,
    ChecklistService,
    StorageService,
    WebhooksService,
    NotificationsService,
    ExportService,
    AuditService,
    ProjectsService,
    AutoScopeService,
    IntegrationEvidenceService,
  ],
})
export class AppModule implements OnApplicationBootstrap {
  private readonly log = new Logger(AppModule.name);

  constructor(
    private readonly auth: AuthService,
    private readonly storage: StorageService,
    private readonly ingest: FrmrIngestionService,
  ) {}

  async onApplicationBootstrap() {
    await this.auth.ensureSeedAdmin();
    await this.storage.ensureBucket().catch(() => undefined);
    if (process.env.FRMR_AUTO_INGEST !== 'false') {
      this.ingest.ingestFromUrl().catch((e) => {
        this.log.warn(`Initial FRMR ingest failed (set FRMR_OFFLINE_PATH or retry): ${e}`);
      });
    }
  }
}
