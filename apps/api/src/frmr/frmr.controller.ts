import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { FrmrIngestionService } from './frmr-ingestion.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FrdTerm } from '../entities/frd-term.entity';
import { FrrRequirement } from '../entities/frr-requirement.entity';
import { KsiIndicator } from '../entities/ksi-indicator.entity';
import { FrmrVersion } from '../entities/frmr-version.entity';

@Controller('frmr')
export class FrmrController {
  constructor(
    private readonly frmrIngest: FrmrIngestionService,
    @InjectRepository(FrdTerm) private readonly terms: Repository<FrdTerm>,
    @InjectRepository(FrrRequirement) private readonly frr: Repository<FrrRequirement>,
    @InjectRepository(KsiIndicator) private readonly ksi: Repository<KsiIndicator>,
    @InjectRepository(FrmrVersion) private readonly ver: Repository<FrmrVersion>,
  ) {}

  @Post('ingest')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async triggerIngest() {
    return this.frmrIngest.ingestFromUrl();
  }

  @Get('versions')
  async versions() {
    return this.frmrIngest.listVersions();
  }

  @Get('terms')
  async termList(
    @Query('q') q?: string,
    @Query('limit') limit = '100',
    @Query('offset') offset = '0',
  ) {
    const v = await this.frmrIngest.getLatestVersion();
    if (!v) return { items: [], total: 0 };
    const qb = this.terms
      .createQueryBuilder('t')
      .where('t.version_id = :vid', { vid: v.id });
    if (q) {
      qb.andWhere(
        '(t.term ILIKE :q OR t.stable_id ILIKE :q OR t.definition ILIKE :q)',
        { q: `%${q}%` },
      );
    }
    const total = await qb.getCount();
    const items = await qb
      .orderBy('t.term', 'ASC')
      .take(+limit)
      .skip(+offset)
      .getMany();
    return { items, total, versionId: v.id };
  }

  @Get('requirements')
  async requirements(
    @Query('process') process?: string,
    @Query('layer') layer?: string,
    @Query('limit') limit = '200',
    @Query('offset') offset = '0',
  ) {
    const v = await this.frmrIngest.getLatestVersion();
    if (!v) return { items: [], total: 0 };
    const qb = this.frr
      .createQueryBuilder('r')
      .where('r.version_id = :vid', { vid: v.id });
    if (process) qb.andWhere('r.process_id = :p', { p: process });
    if (layer) qb.andWhere('r.layer = :l', { l: layer });
    const total = await qb.getCount();
    const items = await qb
      .orderBy('r.process_id', 'ASC')
      .addOrderBy('r.req_key', 'ASC')
      .take(+limit)
      .skip(+offset)
      .getMany();
    return { items, total, versionId: v.id };
  }

  @Get('taxonomy')
  async taxonomy(
    @Query('pathType') pathType?: '20x' | 'rev5',
    @Query('layer') layer?: 'both' | '20x' | 'rev5',
    @Query('actor') actor?: string,
  ) {
    const v = await this.frmrIngest.getLatestVersion();
    if (!v) {
      return {
        versionId: null,
        layer: layer || null,
        pathType: pathType || null,
        actors: [],
        processes: [],
        ksiIndicators: [],
      };
    }

    const effectiveLayer =
      layer || (pathType === '20x' ? '20x' : pathType === 'rev5' ? 'rev5' : undefined);

    const qb = this.frr
      .createQueryBuilder('r')
      .where('r.version_id = :vid', { vid: v.id });

    if (effectiveLayer) {
      qb.andWhere('(r.layer = :layer OR r.layer = :both)', {
        layer: effectiveLayer,
        both: 'both',
      });
    }
    if (actor) {
      qb.andWhere('r.actor_label = :actor', { actor });
    }

    const requirements = await qb
      .orderBy('r.process_id', 'ASC')
      .addOrderBy('r.req_key', 'ASC')
      .getMany();

    const processes = new Map<
      string,
      {
        processId: string;
        actors: string[];
        requirements: Array<{
          reqKey: string;
          layer: string;
          actorLabel: string;
          impactLevel: string | null;
          name: string | null;
          statement: string;
          primaryKeyWord: string | null;
        }>;
      }
    >();

    for (const req of requirements) {
      if (!processes.has(req.processId)) {
        processes.set(req.processId, {
          processId: req.processId,
          actors: [],
          requirements: [],
        });
      }
      const proc = processes.get(req.processId)!;
      if (!proc.actors.includes(req.actorLabel)) proc.actors.push(req.actorLabel);
      proc.requirements.push({
        reqKey: req.reqKey,
        layer: req.layer,
        actorLabel: req.actorLabel,
        impactLevel: req.impactLevel || null,
        name: req.name || null,
        statement: req.statement,
        primaryKeyWord: req.primaryKeyWord || null,
      });
    }

    const ksiQb = this.ksi
      .createQueryBuilder('k')
      .where('k.version_id = :vid', { vid: v.id });
    const ksiIndicators = await ksiQb
      .orderBy('k.domain_code', 'ASC')
      .addOrderBy('k.indicator_id', 'ASC')
      .getMany();

    return {
      versionId: v.id,
      pathType: pathType || null,
      layer: effectiveLayer || null,
      actors: [...new Set(requirements.map((r) => r.actorLabel))].sort(),
      processes: [...processes.values()],
      ksiIndicators: ksiIndicators.map((k) => ({
        domainCode: k.domainCode,
        domainName: k.domainName,
        indicatorId: k.indicatorId,
        name: k.name || null,
        statement: k.statement,
        controls: k.controls || [],
        isProcessKsi: k.isProcessKsi,
      })),
    };
  }

  @Get('ksi')
  async ksiList(
    @Query('domain') domain?: string,
    @Query('limit') limit = '200',
    @Query('offset') offset = '0',
  ) {
    const v = await this.frmrIngest.getLatestVersion();
    if (!v) return { items: [], total: 0 };
    const qb = this.ksi
      .createQueryBuilder('k')
      .where('k.version_id = :vid', { vid: v.id });
    if (domain) qb.andWhere('k.domain_code = :d', { d: domain });
    const total = await qb.getCount();
    const items = await qb
      .orderBy('k.domain_code', 'ASC')
      .take(+limit)
      .skip(+offset)
      .getMany();
    return { items, total, versionId: v.id };
  }

  @Get('mappings/nist/:control')
  async nistMap(@Param('control') control: string) {
    const v = await this.frmrIngest.getLatestVersion();
    if (!v) return [];
    const c = control.toLowerCase().replace(/^([a-z]{2})-(\d+)/i, (_, a, n) => `${a}-${n}`);
    const all = await this.ksi.find({ where: { versionId: v.id } });
    return all.filter((k) =>
      (k.controls || []).some((x) => String(x).toLowerCase() === c),
    );
  }

  @Get('diff/:from/:to')
  async diff(@Param('from') from: string, @Param('to') to: string) {
    const [a, b] = await Promise.all([
      this.frr.find({ where: { versionId: from } }),
      this.frr.find({ where: { versionId: to } }),
    ]);
    const keysA = new Set(a.map((x) => `${x.processId}:${x.reqKey}`));
    const keysB = new Set(b.map((x) => `${x.processId}:${x.reqKey}`));
    const added = [...keysB].filter((k) => !keysA.has(k));
    const removed = [...keysA].filter((k) => !keysB.has(k));
    return { added, removed, summary: { added: added.length, removed: removed.length } };
  }
}
