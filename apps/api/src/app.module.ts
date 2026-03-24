import { Module, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { AuthModule } from './auth/auth.module';
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
import { PoamService } from './poam/poam.service';
import { ProjectSnapshotService } from './project-snapshots/project-snapshot.service';
import { CatalogController } from './catalog/catalog.controller';
import { FrmrCatalogSyncService } from './catalog/frmr-catalog-sync.service';
import { CatalogPackageService } from './catalog/catalog-package.service';
import { ConnectorsController } from './connectors/connectors.controller';
import { ConnectorRegistry } from './connectors/connector-registry';
import { ConnectorOrchestratorService } from './connectors/connector-orchestrator.service';
import { ConnectorInstanceService } from './connectors/connector-instance.service';
import { ConnectorSchedulerService } from './connectors/connector-scheduler.service';
import { SyntheticConnector } from './connectors/impl/synthetic.connector';
import { GithubConnector } from './connectors/impl/github.connector';
import { GitlabConnector } from './connectors/impl/gitlab.connector';
import { AwsCloudTrailConnector } from './connectors/impl/aws-cloudtrail.connector';
import { AwsConfigConnector } from './connectors/impl/aws-config.connector';
import { OktaConnector } from './connectors/impl/okta.connector';
import { EntraConnector } from './connectors/impl/entra.connector';
import { JiraConnector } from './connectors/impl/jira.connector';
import { LinearConnector } from './connectors/impl/linear.connector';
import { SlackConnector } from './connectors/impl/slack.connector';
import { TeamsConnector } from './connectors/impl/teams.connector';
import { RisksController } from './risks/risks.controller';
import { RiskService } from './risks/risk.service';
import { DashboardModule } from './dashboard/dashboard.module';

function resolveSqlitePath(): string {
  const explicit = process.env.SQLITE_PATH;
  if (explicit) return explicit;
  const dataDir = process.env.LOCAL_DATA_DIR || process.cwd();
  return join(dataDir, 'grc.sqlite');
}

function buildTypeOrmConfig() {
  const sync = process.env.DB_SYNC !== 'false';
  const runMigrations = process.env.DB_MIGRATIONS_RUN === 'true';
  const migrations = [join(__dirname, 'migrations', '*.{ts,js}')];
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
      synchronize: sync,
      migrations: runMigrations ? migrations : [],
      migrationsRun: runMigrations,
      logging: process.env.DB_LOG === 'true',
    };
  }

  return {
    type: 'sqlite' as const,
    database: resolveSqlitePath(),
    entities,
    synchronize: sync,
    migrations: runMigrations ? migrations : [],
    migrationsRun: runMigrations,
    logging: process.env.DB_LOG === 'true',
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: parseInt(config.get<string>('API_THROTTLE_TTL_MS') || '60000', 10),
            limit: parseInt(config.get<string>('API_THROTTLE_LIMIT') || '120', 10),
          },
        ],
        skipIf: (ctx) => {
          const req = ctx.switchToHttp().getRequest<{ url?: string }>();
          const url = req.url || '';
          return (
            url.startsWith('/health') ||
            url.startsWith('/docs') ||
            url.startsWith('/docs-json') ||
            url.startsWith('/integrations/')
          );
        },
      }),
    }),
    AuthModule,
    DashboardModule,
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
    CatalogController,
    ConnectorsController,
    RisksController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    RolesGuard,
    FrmrParserService,
    FrmrIngestionService,
    FrmrCatalogSyncService,
    CatalogPackageService,
    ChecklistService,
    StorageService,
    WebhooksService,
    NotificationsService,
    ExportService,
    AuditService,
    ProjectsService,
    AutoScopeService,
    IntegrationEvidenceService,
    PoamService,
    ProjectSnapshotService,
    SyntheticConnector,
    GithubConnector,
    GitlabConnector,
    AwsCloudTrailConnector,
    AwsConfigConnector,
    OktaConnector,
    EntraConnector,
    JiraConnector,
    LinearConnector,
    SlackConnector,
    TeamsConnector,
    ConnectorRegistry,
    ConnectorOrchestratorService,
    ConnectorInstanceService,
    ConnectorSchedulerService,
    RiskService,
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
