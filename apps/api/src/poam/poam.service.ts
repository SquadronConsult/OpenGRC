import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PoamEntry } from '../entities/poam-entry.entity';
import { Project } from '../entities/project.entity';
import { ExportService } from '../export/export.service';

@Injectable()
export class PoamService {
  constructor(
    @InjectRepository(PoamEntry) private readonly poamRepo: Repository<PoamEntry>,
    @InjectRepository(Project) private readonly projRepo: Repository<Project>,
    private readonly exportSvc: ExportService,
  ) {}

  async syncFromChecklist(projectId: string): Promise<{ saved: number }> {
    const project = await this.projRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    const sources = await this.exportSvc.derivePoamRowSources(projectId);
    await this.poamRepo.delete({ projectId });
    for (const s of sources) {
      const row = this.poamRepo.create({
        projectId,
        checklistItemId: s.checklistItemId,
        rowData: s.row as unknown as Record<string, unknown>,
      });
      await this.poamRepo.save(row);
    }
    return { saved: sources.length };
  }

  async clearStored(projectId: string): Promise<{ deleted: number }> {
    const res = await this.poamRepo.delete({ projectId });
    return { deleted: res.affected ?? 0 };
  }
}
