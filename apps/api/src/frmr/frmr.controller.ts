import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FrmrIngestionService } from './frmr-ingestion.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FrdTerm } from '../entities/frd-term.entity';
import { FrrRequirement } from '../entities/frr-requirement.entity';
import { KsiIndicator } from '../entities/ksi-indicator.entity';
import { FrmrVersion } from '../entities/frmr-version.entity';
import {
  FrmrKsiQueryDto,
  FrmrRequirementQueryDto,
  FrmrTermQueryDto,
} from './dto/frmr-list-query.dto';
import { MAX_LIST_LIMIT, skipTakeFromPageLimit } from '../common/dto/page-limit-query.dto';

@ApiTags('frmr')
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
  @ApiOperation({ summary: 'Trigger FRMR ingest (admin)' })
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async triggerIngest() {
    return this.frmrIngest.ingestFromUrl();
  }

  @Get('versions')
  @ApiOperation({ summary: 'List FRMR versions' })
  async versions() {
    return this.frmrIngest.listVersions();
  }

  @Get('terms')
  @ApiOperation({ summary: 'Search FRMR terms (paginated; default limit 100)' })
  async termList(@Query() query: FrmrTermQueryDto) {
    const v = await this.frmrIngest.getLatestVersion();
    if (!v) {
      return { items: [], total: 0, page: 1, limit: 100, hasMore: false };
    }
    const paging = skipTakeFromPageLimit({
      ...query,
      limit: query.limit ?? 100,
      page: query.page,
    });
    const qb = this.terms
      .createQueryBuilder('t')
      .where('t.version_id = :vid', { vid: v.id });
    if (query.q) {
      qb.andWhere(
        '(t.term ILIKE :q OR t.stable_id ILIKE :q OR t.definition ILIKE :q)',
        { q: `%${query.q}%` },
      );
    }
    const total = await qb.getCount();
    const items = await qb
      .orderBy('t.term', 'ASC')
      .skip(paging.skip)
      .take(paging.take)
      .getMany();
    return {
      items,
      total,
      page: paging.page,
      limit: paging.take,
      hasMore: paging.page * paging.take < total,
      versionId: v.id,
    };
  }

  @Get('requirements')
  @ApiOperation({ summary: 'List FRMR requirements (paginated; default limit 200)' })
  async requirements(@Query() query: FrmrRequirementQueryDto) {
    const v = await this.frmrIngest.getLatestVersion();
    if (!v) {
      return { items: [], total: 0, page: 1, limit: 200, hasMore: false };
    }
    const paging = skipTakeFromPageLimit({
      ...query,
      limit: query.limit ?? 200,
      page: query.page,
    });
    const qb = this.frr
      .createQueryBuilder('r')
      .where('r.version_id = :vid', { vid: v.id });
    if (query.process) qb.andWhere('r.process_id = :p', { p: query.process });
    if (query.layer) qb.andWhere('r.layer = :l', { l: query.layer });
    const total = await qb.getCount();
    const items = await qb
      .orderBy('r.process_id', 'ASC')
      .addOrderBy('r.req_key', 'ASC')
      .skip(paging.skip)
      .take(paging.take)
      .getMany();
    return {
      items,
      total,
      page: paging.page,
      limit: paging.take,
      hasMore: paging.page * paging.take < total,
      versionId: v.id,
    };
  }

  @Get('taxonomy')
  @ApiOperation({ summary: 'FRMR taxonomy snapshot' })
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
  @ApiOperation({ summary: 'List KSI indicators (paginated; default limit 200)' })
  async ksiList(@Query() query: FrmrKsiQueryDto) {
    const v = await this.frmrIngest.getLatestVersion();
    if (!v) {
      return { items: [], total: 0, page: 1, limit: 200, hasMore: false };
    }
    const paging = skipTakeFromPageLimit({
      ...query,
      limit: query.limit ?? 200,
      page: query.page,
    });
    const qb = this.ksi
      .createQueryBuilder('k')
      .where('k.version_id = :vid', { vid: v.id });
    if (query.domain) qb.andWhere('k.domain_code = :d', { d: query.domain });
    const total = await qb.getCount();
    const items = await qb
      .orderBy('k.domain_code', 'ASC')
      .skip(paging.skip)
      .take(paging.take)
      .getMany();
    return {
      items,
      total,
      page: paging.page,
      limit: paging.take,
      hasMore: paging.page * paging.take < total,
      versionId: v.id,
    };
  }

  @Get('mappings/nist/:control')
  @ApiOperation({
    summary: 'Map NIST control to KSI',
    description: `Filters KSI rows for a version match; response is capped at ${MAX_LIST_LIMIT} items.`,
  })
  async nistMap(@Param('control') control: string) {
    const v = await this.frmrIngest.getLatestVersion();
    if (!v) return [];
    const c = control.toLowerCase().replace(/^([a-z]{2})-(\d+)/i, (_, a, n) => `${a}-${n}`);
    const all = await this.ksi.find({ where: { versionId: v.id } });
    return all
      .filter((k) =>
        (k.controls || []).some((x) => String(x).toLowerCase() === c),
      )
      .slice(0, MAX_LIST_LIMIT);
  }

  @Get('diff/:from/:to')
  @ApiOperation({ summary: 'Diff two FRMR versions' })
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
