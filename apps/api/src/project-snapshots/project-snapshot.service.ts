import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectSnapshot } from '../entities/project-snapshot.entity';
import { Project } from '../entities/project.entity';

@Injectable()
export class ProjectSnapshotService {
  constructor(
    @InjectRepository(ProjectSnapshot) private readonly snapRepo: Repository<ProjectSnapshot>,
    @InjectRepository(Project) private readonly projRepo: Repository<Project>,
  ) {}

  async create(
    projectId: string,
    title: string,
    kind: string,
    payload: Record<string, unknown>,
  ) {
    const project = await this.projRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    const row = this.snapRepo.create({
      projectId,
      title,
      kind,
      payload,
    });
    return this.snapRepo.save(row);
  }

  async list(projectId: string, limit = 20) {
    return this.snapRepo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
