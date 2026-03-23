import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FrmrParserService } from './frmr-parser.service';
import { FrmrVersion } from '../entities/frmr-version.entity';
import { FrdTerm } from '../entities/frd-term.entity';
import { FrrRequirement } from '../entities/frr-requirement.entity';
import { KsiIndicator } from '../entities/ksi-indicator.entity';
import { access, readFile } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';

const DEFAULT_URL =
  'https://raw.githubusercontent.com/FedRAMP/docs/main/FRMR.documentation.json';

function defaultLocalFrmrPath(): string {
  const base = process.env.LOCAL_DATA_DIR || process.cwd();
  return join(base, 'FRMR.documentation.json');
}

@Injectable()
export class FrmrIngestionService {
  private readonly log = new Logger(FrmrIngestionService.name);

  constructor(
    private readonly parser: FrmrParserService,
    @InjectRepository(FrmrVersion)
    private readonly verRepo: Repository<FrmrVersion>,
    @InjectRepository(FrdTerm)
    private readonly termRepo: Repository<FrdTerm>,
    @InjectRepository(FrrRequirement)
    private readonly frrRepo: Repository<FrrRequirement>,
    @InjectRepository(KsiIndicator)
    private readonly ksiRepo: Repository<KsiIndicator>,
  ) {}

  async ingestFromUrl(url = DEFAULT_URL): Promise<FrmrVersion> {
    let raw: string;
    const localPath = process.env.FRMR_OFFLINE_PATH || defaultLocalFrmrPath();
    const preferLocal = process.env.FRMR_PREFER_LOCAL !== 'false';
    if (preferLocal && (await this.exists(localPath))) {
      raw = await readFile(localPath, 'utf-8');
      this.log.log(`Using local FRMR source: ${localPath}`);
    } else {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Fetch FRMR failed: ${res.status}`);
      raw = await res.text();
    }
    const checksum = this.parser.checksum(raw);
    const existing = await this.verRepo.findOne({
      where: { sourceChecksum: checksum },
    });
    if (existing) {
      this.log.log(`FRMR checksum unchanged, skipping duplicate ingest`);
      return existing;
    }

    const parsed = this.parser.parse(raw);
    const ver = new FrmrVersion();
    ver.frmrRelease = parsed.info.version;
    ver.lastUpdated = parsed.info.last_updated;
    ver.sourceChecksum = checksum;
    ver.rawSnapshot =
      process.env.FRMR_STORE_RAW === 'true'
        ? (JSON.parse(raw) as Record<string, unknown>)
        : null;
    ver.parseOk = true;
    ver.parseErrors = parsed.errors.length ? parsed.errors : null;
    await this.verRepo.save(ver);

    const terms = parsed.frdTerms.map((t) =>
      this.termRepo.create({
        versionId: ver.id,
        stableId: t.stableId,
        term: t.term,
        alts: t.alts?.length ? t.alts : ([] as string[]),
        definition: t.definition,
        updated: t.updated,
      }),
    );
    if (terms.length) await this.termRepo.save(terms, { chunk: 200 });

    const frr = parsed.frrRequirements.map((r) =>
      this.frrRepo.create({
        versionId: ver.id,
        processId: r.processId,
        layer: r.layer,
        actorLabel: r.actorLabel,
        reqKey: r.reqKey,
        name: r.name,
        statement: r.statement,
        primaryKeyWord: r.primaryKeyWord,
        affects: r.affects,
        terms: r.terms,
        timeframeType: r.timeframeType,
        timeframeNum: r.timeframeNum,
        impactLevel: r.impactLevel,
        raw: r.raw,
      }),
    );
    if (frr.length) await this.frrRepo.save(frr, { chunk: 500 });

    const seen = new Set<string>();
    const ksi = parsed.ksiIndicators.filter((k) => {
      const key = `${k.indicatorId}:${k.isProcessKsi}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const ksiRows = ksi.map((k) =>
      this.ksiRepo.create({
        versionId: ver.id,
        domainCode: k.domainCode,
        domainName: k.domainName,
        indicatorId: k.indicatorId,
        name: k.name,
        statement: k.statement,
        controls: k.controls,
        terms: k.terms,
        raw: k.raw,
        isProcessKsi: k.isProcessKsi,
      }),
    );
    if (ksiRows.length) await this.ksiRepo.save(ksiRows, { chunk: 300 });

    this.log.log(
      `Ingested FRMR ${ver.frmrRelease} terms=${terms.length} frr=${frr.length} ksi=${ksiRows.length}`,
    );
    return ver;
  }

  async getLatestVersion(): Promise<FrmrVersion | null> {
    return this.verRepo.find({
      order: { ingestedAt: 'DESC' },
      take: 1,
    }).then((rows) => rows[0] ?? null);
  }

  async listVersions(): Promise<FrmrVersion[]> {
    return this.verRepo.find({ order: { ingestedAt: 'DESC' }, take: 20 });
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await access(path, constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduledIngest() {
    try {
      await this.ingestFromUrl();
    } catch (e) {
      this.log.warn(`Scheduled FRMR ingest: ${e}`);
    }
  }
}
