import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SortOrder } from '../common/sort/parse-sort';
import { toPaginated } from '../common/pagination/paginated-result';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { User } from '../entities/user.entity';
import { SourceSnapshot } from '../entities/source-snapshot.entity';
import { DetectorFinding } from '../entities/detector-finding.entity';
import { WebhookSubscription } from '../entities/webhook-subscription.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly proj: Repository<Project>,
    @InjectRepository(ProjectMember) private readonly mem: Repository<ProjectMember>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(SourceSnapshot)
    private readonly sourceSnapshots: Repository<SourceSnapshot>,
    @InjectRepository(DetectorFinding)
    private readonly detectorFindings: Repository<DetectorFinding>,
    @InjectRepository(WebhookSubscription)
    private readonly webhooks: Repository<WebhookSubscription>,
  ) {}

  async assertAccess(projectId: string, userId: string, role: string) {
    if (role === 'admin') return;
    const m = await this.mem.findOne({
      where: { projectId, userId },
    });
    if (!m) throw new ForbiddenException('No access to project');
  }

  /** Used when the caller was authenticated with a project integration key (no JWT user). */
  async ensureProjectExists(projectId: string) {
    const p = await this.proj.findOne({ where: { id: projectId } });
    if (!p) throw new NotFoundException('Project not found');
  }

  async create(
    userId: string,
    dto: {
      name: string;
      pathType: '20x' | 'rev5';
      impactLevel: 'low' | 'moderate' | 'high';
      actorLabels?: string;
      complianceStartDate?: string;
    },
  ) {
    const defaults =
      dto.pathType === '20x' ? 'CSO,CSX' : 'CSO,CSL';
    const p = this.proj.create({
      name: dto.name,
      pathType: dto.pathType,
      impactLevel: dto.impactLevel,
      actorLabels: dto.actorLabels || defaults,
      ownerId: userId,
      ...(dto.complianceStartDate
        ? { complianceStartDate: new Date(dto.complianceStartDate) }
        : {}),
    });
    await this.proj.save(p);
    await this.mem.save(
      this.mem.create({ projectId: p.id, userId, role: 'owner' }),
    );
    return p;
  }

  async listForUser(userId: string, role: string) {
    if (role === 'admin') return this.proj.find({ order: { createdAt: 'DESC' } });
    const mids = await this.mem.find({ where: { userId } });
    const ids = mids.map((m) => m.projectId);
    if (!ids.length) return [];
    return this.proj
      .createQueryBuilder('p')
      .where('p.id IN (:...ids)', { ids })
      .orderBy('p.created_at', 'DESC')
      .getMany();
  }

  async listForUserPaginated(
    userId: string,
    role: string,
    paging: { skip: number; take: number; page: number; limit: number },
    sort: { column: string; order: SortOrder },
  ) {
    let qb = this.proj.createQueryBuilder('p');
    if (role !== 'admin') {
      const mids = await this.mem.find({ where: { userId } });
      const ids = mids.map((m) => m.projectId);
      if (!ids.length) {
        return toPaginated([], paging.page, paging.limit, 0);
      }
      qb = qb.where('p.id IN (:...ids)', { ids });
    }
    const total = await qb.getCount();
    const rows = await qb
      .clone()
      .orderBy(sort.column, sort.order)
      .skip(paging.skip)
      .take(paging.take)
      .getMany();
    return toPaginated(rows, paging.page, paging.limit, total);
  }

  async get(projectId: string, userId: string, role: string) {
    await this.assertAccess(projectId, userId, role);
    const p = await this.proj.findOne({ where: { id: projectId } });
    if (!p) throw new NotFoundException();
    return p;
  }

  async addMember(
    projectId: string,
    actorId: string,
    actorRole: string,
    email: string,
    memberRole: string,
  ) {
    await this.assertAccess(projectId, actorId, actorRole);
    const user = await this.users.findOne({
      where: { email: email.toLowerCase() },
    });
    if (!user) throw new NotFoundException('User not found');
    const exists = await this.mem.findOne({
      where: { projectId, userId: user.id },
    });
    if (exists) return exists;
    return this.mem.save(
      this.mem.create({
        projectId,
        userId: user.id,
        role: memberRole,
      }),
    );
  }

  async remove(projectId: string, userId: string, role: string) {
    const p = await this.proj.findOne({ where: { id: projectId } });
    if (!p) throw new NotFoundException('Project not found');
    await this.assertAccess(projectId, userId, role);

    // Cleanup records that reference project_id without FK cascade constraints.
    await this.sourceSnapshots.delete({ projectId });
    await this.detectorFindings.delete({ projectId });
    await this.webhooks.delete({ projectId });

    await this.proj.delete({ id: projectId });
    return { deleted: true };
  }
}
