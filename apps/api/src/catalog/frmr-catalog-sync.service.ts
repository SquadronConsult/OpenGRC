import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Framework } from '../entities/framework.entity';
import { FrameworkRelease } from '../entities/framework-release.entity';
import { CatalogControl } from '../entities/catalog-control.entity';
import { CatalogRequirement } from '../entities/catalog-requirement.entity';
import { FrmrVersion } from '../entities/frmr-version.entity';
import { FrrRequirement } from '../entities/frr-requirement.entity';
import { KsiIndicator } from '../entities/ksi-indicator.entity';

export const FRAMEWORK_CODE_FEDRAMP_FRMR = 'fedramp_frmr';

@Injectable()
export class FrmrCatalogSyncService {
  private readonly log = new Logger(FrmrCatalogSyncService.name);

  constructor(
    @InjectRepository(Framework)
    private readonly fwRepo: Repository<Framework>,
    @InjectRepository(FrameworkRelease)
    private readonly relRepo: Repository<FrameworkRelease>,
    @InjectRepository(CatalogControl)
    private readonly ctrlRepo: Repository<CatalogControl>,
    @InjectRepository(CatalogRequirement)
    private readonly reqRepo: Repository<CatalogRequirement>,
    @InjectRepository(FrmrVersion)
    private readonly verRepo: Repository<FrmrVersion>,
    @InjectRepository(FrrRequirement)
    private readonly frrRepo: Repository<FrrRequirement>,
    @InjectRepository(KsiIndicator)
    private readonly ksiRepo: Repository<KsiIndicator>,
  ) {}

  /** Project FRMR tables into the generic catalog for a given ingested version. Idempotent. */
  async syncFromFrmrVersion(frmrVersionId: string): Promise<FrameworkRelease> {
    const ver = await this.verRepo.findOne({ where: { id: frmrVersionId } });
    if (!ver) throw new Error(`FrmrVersion not found: ${frmrVersionId}`);

    let framework = await this.fwRepo.findOne({
      where: { code: FRAMEWORK_CODE_FEDRAMP_FRMR },
    });
    if (!framework) {
      framework = await this.fwRepo.save(
        this.fwRepo.create({
          id: randomUUID(),
          code: FRAMEWORK_CODE_FEDRAMP_FRMR,
          name: 'FedRAMP FRMR',
          description: 'FedRAMP Requirements Management Repository (adapter-backed).',
        }),
      );
    }

    const releaseCode = ver.sourceChecksum
      ? `frmr-${ver.sourceChecksum.slice(0, 12)}`
      : `frmr-${ver.frmrRelease.replace(/\s+/g, '-')}`;

    let release = await this.relRepo.findOne({
      where: { frmrVersionId: ver.id },
    });
    if (!release) {
      release = await this.relRepo.save(
        this.relRepo.create({
          id: randomUUID(),
          frameworkId: framework.id,
          releaseCode,
          label: ver.frmrRelease,
          metadata: { lastUpdated: ver.lastUpdated },
          frmrVersionId: ver.id,
        }),
      );
    } else {
      release.releaseCode = releaseCode;
      release.label = ver.frmrRelease;
      release.metadata = { ...(release.metadata || {}), lastUpdated: ver.lastUpdated };
      await this.relRepo.save(release);
    }

    const frrList = await this.frrRepo.find({ where: { versionId: ver.id } });
    const processIds = [...new Set(frrList.map((r) => r.processId))];
    const controlByProcess = new Map<string, CatalogControl>();

    for (const pid of processIds) {
      let ctrl = await this.ctrlRepo.findOne({
        where: { frameworkReleaseId: release.id, controlCode: pid },
      });
      if (!ctrl) {
        ctrl = await this.ctrlRepo.save(
          this.ctrlRepo.create({
            id: randomUUID(),
            frameworkReleaseId: release.id,
            controlCode: pid,
            title: `Process ${pid}`,
            description: null,
            metadata: { frmr: true },
          }),
        );
      }
      controlByProcess.set(pid, ctrl);
    }

    for (const r of frrList) {
      const reqCode = this.frrRequirementCode(r);
      const ctrl = controlByProcess.get(r.processId);
      let row = await this.reqRepo.findOne({
        where: {
          frameworkReleaseId: release.id,
          requirementCode: reqCode,
        },
      });
      const payload = {
        frameworkReleaseId: release.id,
        catalogControlId: ctrl?.id ?? null,
        requirementCode: reqCode,
        statement: r.statement,
        kind: 'frr' as const,
        sourceFrrId: r.id,
        sourceKsiId: null,
        metadata: {
          processId: r.processId,
          layer: r.layer,
          actorLabel: r.actorLabel,
          reqKey: r.reqKey,
          impactLevel: r.impactLevel,
        },
      };
      if (row) {
        Object.assign(row, payload);
        await this.reqRepo.save(row);
      } else {
        await this.reqRepo.save(
          this.reqRepo.create({
            id: randomUUID(),
            ...payload,
          }),
        );
      }
    }

    const ksiList = await this.ksiRepo.find({ where: { versionId: ver.id } });
    for (const k of ksiList) {
      const reqCode = this.ksiRequirementCode(k);
      let row = await this.reqRepo.findOne({
        where: {
          frameworkReleaseId: release.id,
          requirementCode: reqCode,
        },
      });
      const payload = {
        frameworkReleaseId: release.id,
        catalogControlId: null,
        requirementCode: reqCode,
        statement: k.statement || k.name || '',
        kind: 'ksi' as const,
        sourceFrrId: null,
        sourceKsiId: k.id,
        metadata: {
          domainCode: k.domainCode,
          indicatorId: k.indicatorId,
          isProcessKsi: k.isProcessKsi,
        },
      };
      if (row) {
        Object.assign(row, payload);
        await this.reqRepo.save(row);
      } else {
        await this.reqRepo.save(
          this.reqRepo.create({
            id: randomUUID(),
            ...payload,
          }),
        );
      }
    }

    this.log.log(
      `FRMR catalog sync: release=${release.id} frr=${frrList.length} ksi=${ksiList.length}`,
    );
    return release;
  }

  frrRequirementCode(r: FrrRequirement): string {
    const il = r.impactLevel ?? 'null';
    return `frr:${r.processId}:${r.layer}:${r.actorLabel}:${r.reqKey}:${il}`;
  }

  ksiRequirementCode(k: KsiIndicator): string {
    return `ksi:${k.domainCode}:${k.indicatorId}:${k.isProcessKsi ? 'proc' : 'dom'}`;
  }

  async findCatalogRequirementForFrr(
    frameworkReleaseId: string,
    frrId: string,
  ): Promise<CatalogRequirement | null> {
    return this.reqRepo.findOne({
      where: { frameworkReleaseId, sourceFrrId: frrId },
    });
  }

  async findCatalogRequirementForKsi(
    frameworkReleaseId: string,
    ksiId: string,
  ): Promise<CatalogRequirement | null> {
    return this.reqRepo.findOne({
      where: { frameworkReleaseId, sourceKsiId: ksiId },
    });
  }

  async getReleaseForFrmrVersion(
    frmrVersionId: string,
  ): Promise<FrameworkRelease | null> {
    return this.relRepo.findOne({ where: { frmrVersionId } });
  }
}
