import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Finding } from '../entities/finding.entity';
import { ChecklistItem } from '../entities/checklist-item.entity';
import { ProjectsService } from '../projects/projects.service';
import { AuditService } from '../audit/audit.service';

@Controller('findings')
@UseGuards(JwtAuthGuard)
export class FindingsController {
  constructor(
    @InjectRepository(Finding) private readonly repo: Repository<Finding>,
    @InjectRepository(ChecklistItem) private readonly items: Repository<ChecklistItem>,
    private readonly projects: ProjectsService,
    private readonly audit: AuditService,
  ) {}

  @Post()
  async create(
    @Req() req: { user: { userId: string; role: string } },
    @Body()
    b: {
      checklistItemId: string;
      title: string;
      description?: string;
      severity?: string;
    },
  ) {
    const item = await this.items.findOne({ where: { id: b.checklistItemId } });
    if (!item) throw new NotFoundException('Checklist item not found');
    await this.projects.assertAccess(
      item.projectId,
      req.user.userId,
      req.user.role,
    );
    const f = await this.repo.save(
      this.repo.create({
        checklistItemId: b.checklistItemId,
        title: b.title,
        description: b.description,
        severity: b.severity || 'medium',
        createdById: req.user.userId,
      }),
    );
    await this.audit.log(req.user.userId, 'finding.create', 'finding', f.id, {});
    return f;
  }

  @Get('by-checklist/:checklistItemId')
  async list(
    @Param('checklistItemId') cid: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    const item = await this.items.findOne({ where: { id: cid } });
    if (!item) throw new NotFoundException('Checklist item not found');
    await this.projects.assertAccess(
      item.projectId,
      req.user.userId,
      req.user.role,
    );
    return this.repo.find({ where: { checklistItemId: cid } });
  }

  @Patch(':id')
  async patch(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() b: { status?: string; remediationNotes?: string },
  ) {
    const f = await this.repo.findOne({
      where: { id },
      relations: ['checklistItem'],
    });
    if (!f) throw new NotFoundException('Finding not found');
    await this.projects.assertAccess(
      f.checklistItem.projectId,
      req.user.userId,
      req.user.role,
    );
    if (b.status) f.status = b.status;
    if (b.remediationNotes !== undefined) f.remediationNotes = b.remediationNotes;
    await this.repo.save(f);
    return f;
  }
}
