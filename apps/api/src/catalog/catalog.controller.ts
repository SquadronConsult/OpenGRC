import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { Framework } from '../entities/framework.entity';
import { FrameworkRelease } from '../entities/framework-release.entity';
import { CatalogRequirement } from '../entities/catalog-requirement.entity';
import { InternalControl } from '../entities/internal-control.entity';
import { InternalControlMapping } from '../entities/internal-control-mapping.entity';
import { FrmrCatalogSyncService } from './frmr-catalog-sync.service';
import { FrmrIngestionService } from '../frmr/frmr-ingestion.service';
import {
  CatalogPackageService,
  type FrameworkPackageV1,
} from './catalog-package.service';
import { PageLimitQueryDto } from '../common/dto/page-limit-query.dto';
import { skipTakeFromPageLimit } from '../common/dto/page-limit-query.dto';
import { toPaginated } from '../common/pagination/paginated-result';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(
    @InjectRepository(Framework) private readonly fw: Repository<Framework>,
    @InjectRepository(FrameworkRelease)
    private readonly rel: Repository<FrameworkRelease>,
    @InjectRepository(CatalogRequirement)
    private readonly req: Repository<CatalogRequirement>,
    @InjectRepository(InternalControl)
    private readonly ic: Repository<InternalControl>,
    @InjectRepository(InternalControlMapping)
    private readonly icm: Repository<InternalControlMapping>,
    private readonly frmrSync: FrmrCatalogSyncService,
    private readonly frmrIngest: FrmrIngestionService,
    private readonly packages: CatalogPackageService,
  ) {}

  @Get('frameworks')
  @ApiOperation({ summary: 'List frameworks' })
  async listFrameworks() {
    return this.fw.find({ order: { code: 'ASC' } });
  }

  @Get('releases/:id')
  @ApiOperation({ summary: 'Get framework release' })
  async getRelease(@Param('id') id: string) {
    return this.rel.findOne({
      where: { id },
      relations: ['framework', 'frmrVersion'],
    });
  }

  @Get('releases/:id/requirements')
  @ApiOperation({
    summary: 'List catalog requirements for release (paginated)',
    description:
      'Previously returned up to 5000 rows in one response; use page/limit to page through large releases.',
  })
  async listRequirements(
    @Param('id') id: string,
    @Query() q: PageLimitQueryDto,
  ) {
    const p = skipTakeFromPageLimit(q);
    const qb = this.req
      .createQueryBuilder('r')
      .where('r.frameworkReleaseId = :id', { id });
    const total = await qb.getCount();
    const items = await qb
      .clone()
      .orderBy('r.requirementCode', 'ASC')
      .skip(p.skip)
      .take(p.take)
      .getMany();
    return toPaginated(items, p.page, p.limit, total);
  }

  /** Re-sync FRMR-backed catalog from the latest ingested FRMR version. */
  @Post('sync-frmr')
  @ApiOperation({ summary: 'Sync catalog from latest FRMR (admin)' })
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async syncFrmr() {
    const v = await this.frmrIngest.getLatestVersion();
    if (!v) return { ok: false, message: 'No FRMR version ingested' };
    const release = await this.frmrSync.syncFromFrmrVersion(v.id);
    return { ok: true, frmrVersionId: v.id, frameworkReleaseId: release.id };
  }

  /** Import a v1 framework package (JSON body). */
  @Post('import-package')
  @ApiOperation({ summary: 'Import framework package (admin)' })
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async importPackage(@Body() body: FrameworkPackageV1) {
    const release = await this.packages.importPackage(body);
    return { ok: true, frameworkReleaseId: release.id };
  }

  @Get('internal-controls')
  @ApiOperation({
    summary: 'List internal controls (paginated)',
    description:
      'Previously returned up to 5000 rows in one response; use page/limit for large catalogs.',
  })
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard)
  async listInternalControls(@Query() q: PageLimitQueryDto) {
    const p = skipTakeFromPageLimit(q);
    const qb = this.ic.createQueryBuilder('ic');
    const total = await qb.getCount();
    const items = await qb
      .clone()
      .orderBy('ic.code', 'ASC')
      .skip(p.skip)
      .take(p.take)
      .getMany();
    return toPaginated(items, p.page, p.limit, total);
  }

  @Post('internal-controls')
  @ApiOperation({ summary: 'Create internal control (admin)' })
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async createInternalControl(
    @Body() b: { code: string; title: string; description?: string },
  ) {
    const row = await this.ic.save(
      this.ic.create({
        id: randomUUID(),
        code: b.code,
        title: b.title,
        description: b.description ?? null,
      }),
    );
    return { ok: true, id: row.id };
  }

  @Post('internal-controls/:id/mappings')
  @ApiOperation({ summary: 'Add internal control mapping (admin)' })
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async addInternalMapping(
    @Param('id') internalId: string,
    @Body()
    b: {
      catalogRequirementId: string;
      frameworkCode?: string;
      mappingType?: string;
      priorityRank?: number;
    },
  ) {
    const row = await this.icm.save(
      this.icm.create({
        id: randomUUID(),
        internalControlId: internalId,
        catalogRequirementId: b.catalogRequirementId,
        frameworkCode: b.frameworkCode ?? null,
        mappingType: b.mappingType ?? 'full',
        coverage: null,
        rationale: null,
        source: 'api',
        priorityRank: b.priorityRank ?? 0,
      }),
    );
    return { ok: true, mappingId: row.id };
  }

  @Get('cross-map')
  @ApiOperation({ summary: 'Cross-framework control mappings (read-only)' })
  async crossMap(
    @Query('sourceFramework') sourceFramework?: string,
    @Query('targetFramework') targetFramework?: string,
  ) {
    const qb = this.icm
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.catalogRequirement', 'cr')
      .leftJoinAndSelect('cr.frameworkRelease', 'fr')
      .leftJoinAndSelect('fr.framework', 'fw')
      .leftJoinAndSelect('m.internalControl', 'ic');
    if (sourceFramework) {
      qb.andWhere('fw.code = :sourceFramework', { sourceFramework });
    }
    if (targetFramework) {
      qb.andWhere('m.frameworkCode = :targetFramework OR m.frameworkCode IS NULL', {
        targetFramework,
      });
    }
    const items = await qb.orderBy('m.priorityRank', 'ASC').take(2000).getMany();
    return {
      sourceFramework: sourceFramework ?? null,
      targetFramework: targetFramework ?? null,
      mappings: items.map((m) => ({
        id: m.id,
        internalControlId: m.internalControlId,
        internalControlCode: m.internalControl?.code ?? null,
        catalogRequirementId: m.catalogRequirementId,
        requirementCode: m.catalogRequirement?.requirementCode ?? null,
        frameworkCode: m.frameworkCode,
        mappingType: m.mappingType,
        coverage: m.coverage,
      })),
      total: items.length,
    };
  }

  @Get('internal-controls/:controlId/coverage')
  @ApiOperation({ summary: 'Coverage for one internal control' })
  async internalControlCoverage(@Param('controlId') controlId: string) {
    const ic = await this.ic.findOne({
      where: { id: controlId },
      relations: ['mappings', 'mappings.catalogRequirement'],
    });
    if (!ic) return { control: null, mappings: [] };
    return {
      control: { id: ic.id, code: ic.code, title: ic.title },
      mappings: (ic.mappings || []).map((m) => ({
        catalogRequirementId: m.catalogRequirementId,
        requirementCode: m.catalogRequirement?.requirementCode ?? null,
        coverage: m.coverage,
        mappingType: m.mappingType,
      })),
    };
  }
}
