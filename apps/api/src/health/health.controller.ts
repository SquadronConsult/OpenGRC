import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { copyFile, mkdir, stat } from 'fs/promises';
import { join } from 'path';
import { FrmrIngestionService } from '../frmr/frmr-ingestion.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OPENGRC_API_VERSION, OPENGRC_SCHEMA_VERSION } from '../version';

function resolveSqlitePathForHealth(): string {
  const explicit = process.env.SQLITE_PATH;
  if (explicit) return explicit;
  const dataDir = process.env.LOCAL_DATA_DIR || process.cwd();
  return join(dataDir, 'grc.sqlite');
}

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly ds: DataSource,
    private readonly frmr: FrmrIngestionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  async live() {
    const latest = await this.frmr.getLatestVersion();
    return {
      status: 'ok',
      service: 'grc-api',
      apiVersion: OPENGRC_API_VERSION,
      schemaVersion: OPENGRC_SCHEMA_VERSION,
      frmrLoaded: !!latest,
      frmrRelease: latest?.frmrRelease ?? null,
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness (DB ping)' })
  async ready() {
    await this.ds.query('SELECT 1');
    const latest = await this.frmr.getLatestVersion();
    return {
      ready: true,
      apiVersion: OPENGRC_API_VERSION,
      schemaVersion: OPENGRC_SCHEMA_VERSION,
      frmrLoaded: !!latest,
    };
  }

  /** Local operator diagnostics: paths, sizes, FRMR state (no secrets). */
  @Get('ops')
  @ApiOperation({ summary: 'Operator diagnostics (local)' })
  async ops() {
    const dbType = process.env.DB_TYPE || 'sqlite';
    const evidenceDir = process.env.EVIDENCE_DIR || join(process.cwd(), 'evidence');
    const localDataDir = process.env.LOCAL_DATA_DIR || process.cwd();

    let sqlitePath: string | null = null;
    let sqliteBytes: number | null = null;
    let postgres: {
      host: string;
      port: number;
      database: string;
      username: string;
    } | null = null;

    if (dbType === 'postgres') {
      const o = this.ds.options;
      if (o.type === 'postgres') {
        postgres = {
          host: typeof o.host === 'string' ? o.host : 'localhost',
          port: typeof o.port === 'number' ? o.port : 5432,
          database: typeof o.database === 'string' ? o.database : 'grc',
          username: typeof o.username === 'string' ? o.username : '',
        };
      }
    } else {
      sqlitePath = resolveSqlitePathForHealth();
      try {
        const st = await stat(sqlitePath);
        sqliteBytes = st.size;
      } catch {
        sqliteBytes = null;
      }
    }

    const latest = await this.frmr.getLatestVersion();
    const versions = await this.frmr.listVersions();
    return {
      apiVersion: OPENGRC_API_VERSION,
      schemaVersion: OPENGRC_SCHEMA_VERSION,
      dbType,
      sqlitePath,
      sqliteBytes,
      postgres,
      evidenceDir,
      localDataDir,
      frmrLoaded: !!latest,
      frmrRelease: latest?.frmrRelease ?? null,
      frmrVersionRows: versions.length,
      dbSync: process.env.DB_SYNC !== 'false',
      migrationsRun: process.env.DB_MIGRATIONS_RUN === 'true',
    };
  }

  /** Copy SQLite DB to LOCAL_DATA_DIR/backups (local operator only). */
  @Post('backup')
  @ApiOperation({ summary: 'Backup SQLite database (JWT)' })
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard)
  async backup() {
    const sqlitePath = resolveSqlitePathForHealth();
    if ((process.env.DB_TYPE || 'sqlite') !== 'sqlite') {
      return {
        ok: false,
        message: 'Automated backup endpoint supports SQLite only; use DB-native tools for Postgres.',
      };
    }
    const dir = join(process.env.LOCAL_DATA_DIR || process.cwd(), 'backups');
    await mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = join(dir, `grc-${stamp}.sqlite`);
    await copyFile(sqlitePath, dest);
    const st = await stat(dest);
    return { ok: true, path: dest, bytes: st.size };
  }
}
