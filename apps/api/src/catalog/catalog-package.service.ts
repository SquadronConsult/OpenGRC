import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Framework } from '../entities/framework.entity';
import { FrameworkRelease } from '../entities/framework-release.entity';
import { CatalogControl } from '../entities/catalog-control.entity';
import { CatalogRequirement } from '../entities/catalog-requirement.entity';

/** Importable framework definition (JSON/YAML parsed to this shape). */
export interface FrameworkPackageV1 {
  version?: number;
  framework: { code: string; name: string; description?: string | null };
  release: { releaseCode: string; label?: string | null; metadata?: Record<string, unknown> };
  controls: Array<{
    controlCode: string;
    title?: string | null;
    description?: string | null;
    parentCode?: string | null;
  }>;
  requirements: Array<{
    controlCode?: string | null;
    requirementCode: string;
    statement: string;
    kind?: 'generic';
    metadata?: Record<string, unknown>;
  }>;
}

@Injectable()
export class CatalogPackageService {
  private readonly log = new Logger(CatalogPackageService.name);

  constructor(
    @InjectRepository(Framework)
    private readonly fwRepo: Repository<Framework>,
    @InjectRepository(FrameworkRelease)
    private readonly relRepo: Repository<FrameworkRelease>,
    @InjectRepository(CatalogControl)
    private readonly ctrlRepo: Repository<CatalogControl>,
    @InjectRepository(CatalogRequirement)
    private readonly reqRepo: Repository<CatalogRequirement>,
  ) {}

  async importPackage(pkg: FrameworkPackageV1): Promise<FrameworkRelease> {
    if (pkg.version != null && pkg.version !== 1) {
      this.log.warn(`Unknown package version ${pkg.version}, treating as v1`);
    }

    let fw = await this.fwRepo.findOne({ where: { code: pkg.framework.code } });
    if (!fw) {
      fw = await this.fwRepo.save(
        this.fwRepo.create({
          id: randomUUID(),
          code: pkg.framework.code,
          name: pkg.framework.name,
          description: pkg.framework.description ?? null,
        }),
      );
    } else {
      fw.name = pkg.framework.name;
      fw.description = pkg.framework.description ?? fw.description;
      await this.fwRepo.save(fw);
    }

    let release = await this.relRepo.findOne({
      where: {
        frameworkId: fw.id,
        releaseCode: pkg.release.releaseCode,
      },
    });
    if (!release) {
      release = await this.relRepo.save(
        this.relRepo.create({
          id: randomUUID(),
          frameworkId: fw.id,
          releaseCode: pkg.release.releaseCode,
          label: pkg.release.label ?? pkg.release.releaseCode,
          metadata: pkg.release.metadata ?? null,
          frmrVersionId: null,
        }),
      );
    }

    const ctrlByCode = new Map<string, CatalogControl>();
    for (const c of pkg.controls) {
      let row = await this.ctrlRepo.findOne({
        where: { frameworkReleaseId: release.id, controlCode: c.controlCode },
      });
      if (!row) {
        row = await this.ctrlRepo.save(
          this.ctrlRepo.create({
            id: randomUUID(),
            frameworkReleaseId: release.id,
            controlCode: c.controlCode,
            title: c.title ?? null,
            description: c.description ?? null,
            parentId: null,
            metadata: c.parentCode ? { parentCode: c.parentCode } : null,
          }),
        );
      } else {
        row.title = c.title ?? row.title;
        row.description = c.description ?? row.description;
        await this.ctrlRepo.save(row);
      }
      ctrlByCode.set(c.controlCode, row);
    }

    for (const r of pkg.requirements) {
      const ctrl = r.controlCode ? ctrlByCode.get(r.controlCode) : undefined;
      let row = await this.reqRepo.findOne({
        where: {
          frameworkReleaseId: release.id,
          requirementCode: r.requirementCode,
        },
      });
      const payload = {
        frameworkReleaseId: release.id,
        catalogControlId: ctrl?.id ?? null,
        requirementCode: r.requirementCode,
        statement: r.statement,
        kind: 'generic' as const,
        sourceFrrId: null,
        sourceKsiId: null,
        metadata: r.metadata ?? null,
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
      `Imported framework package ${pkg.framework.code}@${pkg.release.releaseCode} controls=${pkg.controls.length} reqs=${pkg.requirements.length}`,
    );
    return release;
  }
}
