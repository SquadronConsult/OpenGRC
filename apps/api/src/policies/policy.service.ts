import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Policy, PolicyStatus } from '../entities/policy.entity';
import { PolicyVersion } from '../entities/policy-version.entity';
import { PolicyControlMapping } from '../entities/policy-control-mapping.entity';
import { PolicyAttestation } from '../entities/policy-attestation.entity';
import { ProjectsService } from '../projects/projects.service';
import { ProjectMember } from '../entities/project-member.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';

@Injectable()
export class PolicyService {
  constructor(
    @InjectRepository(Policy) private readonly policies: Repository<Policy>,
    @InjectRepository(PolicyVersion)
    private readonly versions: Repository<PolicyVersion>,
    @InjectRepository(PolicyControlMapping)
    private readonly mappings: Repository<PolicyControlMapping>,
    @InjectRepository(PolicyAttestation)
    private readonly attestations: Repository<PolicyAttestation>,
    @InjectRepository(ProjectMember)
    private readonly members: Repository<ProjectMember>,
    private readonly projects: ProjectsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(
    userId: string,
    role: string,
    projectId?: string,
    status?: string,
  ) {
    const qb = this.policies.createQueryBuilder('p');
    if (projectId) {
      await this.projects.assertAccess(projectId, userId, role);
      qb.where('p.projectId = :projectId', { projectId });
    } else if (role === 'admin') {
      qb.where('1=1');
    } else {
      const mids = await this.members.find({ where: { userId } });
      const ids = mids.map((m) => m.projectId);
      if (!ids.length) {
        qb.where('p.projectId IS NULL');
      } else {
        qb.where(
          '(p.projectId IN (:...ids) OR p.projectId IS NULL)',
          { ids },
        );
      }
    }
    if (status) qb.andWhere('p.status = :status', { status });
    qb.orderBy('p.updatedAt', 'DESC');
    return qb.getMany();
  }

  async getById(id: string, userId: string, role: string) {
    const p = await this.policies.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Policy not found');
    if (p.projectId)
      await this.projects.assertAccess(p.projectId, userId, role);
    return p;
  }

  async create(
    userId: string,
    role: string,
    dto: CreatePolicyDto,
  ): Promise<Policy> {
    if (dto.projectId)
      await this.projects.assertAccess(dto.projectId, userId, role);
    const row = this.policies.create({
      projectId: dto.projectId ?? null,
      title: dto.title,
      version: '1.0.0',
      status: 'draft',
      category: dto.category ?? null,
      content: dto.content ?? '',
      ownerUserId: userId,
    });
    await this.policies.save(row);
    await this.audit.log(userId, 'policy.create', 'policy', row.id, {
      title: row.title,
    });
    return row;
  }

  async update(
    id: string,
    userId: string,
    role: string,
    dto: UpdatePolicyDto,
  ): Promise<Policy> {
    const p = await this.getById(id, userId, role);
    if (p.status === 'published' || p.status === 'retired') {
      if (dto.status && dto.status !== p.status)
        throw new ForbiddenException('Use publish workflow for published policies');
    }
    Object.assign(p, {
      ...(dto.title != null && { title: dto.title }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.content != null && { content: dto.content }),
      ...(dto.status != null && { status: dto.status as PolicyStatus }),
      ...(dto.version != null && { version: dto.version }),
      ...(dto.ownerUserId !== undefined && {
        ownerUserId: dto.ownerUserId || null,
      }),
      ...(dto.approverUserId !== undefined && {
        approverUserId: dto.approverUserId || null,
      }),
      ...(dto.effectiveDate !== undefined && {
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : null,
      }),
      ...(dto.nextReviewDate !== undefined && {
        nextReviewDate: dto.nextReviewDate
          ? new Date(dto.nextReviewDate)
          : null,
      }),
    });
    await this.policies.save(p);
    await this.audit.log(userId, 'policy.update', 'policy', id, {
      ...(dto as Record<string, unknown>),
    });
    return p;
  }

  async publish(id: string, userId: string, role: string, changeDescription?: string) {
    const p = await this.getById(id, userId, role);
    const ver = this.versions.create({
      policyId: p.id,
      versionNumber: p.version,
      content: p.content,
      changeDescription: changeDescription ?? null,
      authorUserId: userId,
    });
    await this.versions.save(ver);
    p.status = 'published';
    await this.policies.save(p);
    await this.audit.log(userId, 'policy.publish', 'policy', id, {
      version: p.version,
    });
    return { policy: p, version: ver };
  }

  async listVersions(id: string, userId: string, role: string) {
    await this.getById(id, userId, role);
    return this.versions.find({
      where: { policyId: id },
      order: { createdAt: 'DESC' },
    });
  }

  async setControlMappings(
    id: string,
    userId: string,
    role: string,
    body: {
      catalogRequirementIds?: string[];
      internalControlIds?: string[];
    },
  ) {
    await this.getById(id, userId, role);
    await this.mappings.delete({ policyId: id });
    const rows: PolicyControlMapping[] = [];
    for (const cid of body.catalogRequirementIds ?? []) {
      rows.push(
        this.mappings.create({
          policyId: id,
          catalogRequirementId: cid,
          internalControlId: null,
        }),
      );
    }
    for (const iid of body.internalControlIds ?? []) {
      rows.push(
        this.mappings.create({
          policyId: id,
          catalogRequirementId: null,
          internalControlId: iid,
        }),
      );
    }
    if (rows.length) await this.mappings.save(rows);
    await this.audit.log(userId, 'policy.control_mappings', 'policy', id, body);
    return this.mappings.find({ where: { policyId: id } });
  }

  async requestAttestation(
    id: string,
    userId: string,
    role: string,
    targetUserIds: string[],
    expiresAt?: string,
  ) {
    const p = await this.getById(id, userId, role);
    const latest = await this.versions.findOne({
      where: { policyId: id },
      order: { createdAt: 'DESC' },
    });
    const exp = expiresAt ? new Date(expiresAt) : null;
    for (const uid of targetUserIds) {
      const row = this.attestations.create({
        policyId: p.id,
        policyVersionId: latest?.id ?? null,
        userId: uid,
        status: 'pending',
        attestedAt: null,
        expiresAt: exp,
      });
      await this.attestations.save(row);
      await this.notifications.notify(uid, 'policy.attestation_requested', {
        policyId: p.id,
        policyTitle: p.title,
      });
    }
    await this.audit.log(userId, 'policy.attest_request', 'policy', id, {
      targetUserIds,
    });
    return this.attestations.find({ where: { policyId: id } });
  }

  async attest(
    id: string,
    userId: string,
    role: string,
    acknowledge: boolean,
  ) {
    const p = await this.getById(id, userId, role);
    const row = await this.attestations.findOne({
      where: { policyId: id, userId },
    });
    if (!row) throw new NotFoundException('No attestation for user');
    if (acknowledge) {
      row.status = 'acknowledged';
      row.attestedAt = new Date();
    }
    await this.attestations.save(row);
    await this.audit.log(userId, 'policy.attest', 'policy', id, { acknowledge });
    return row;
  }

  async expirePendingAttestations() {
    const now = new Date();
    const pending = await this.attestations.find({
      where: { status: In(['pending', 'acknowledged']) },
    });
    for (const a of pending) {
      if (a.expiresAt && new Date(a.expiresAt) < now && a.status !== 'expired') {
        a.status = 'expired';
        await this.attestations.save(a);
      }
    }
  }
}
