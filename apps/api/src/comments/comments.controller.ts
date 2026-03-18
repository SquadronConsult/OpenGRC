import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from '../entities/comment.entity';
import { ChecklistItem } from '../entities/checklist-item.entity';
import { ProjectsService } from '../projects/projects.service';

@Controller('comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(
    @InjectRepository(Comment) private readonly repo: Repository<Comment>,
    @InjectRepository(ChecklistItem) private readonly items: Repository<ChecklistItem>,
    private readonly projects: ProjectsService,
  ) {}

  @Get('checklist/:checklistItemId')
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
    return this.repo.find({
      where: { checklistItemId: cid },
      order: { createdAt: 'ASC' },
      relations: ['user'],
    });
  }

  @Post()
  async create(
    @Req() req: { user: { userId: string; role: string } },
    @Body()
    b: {
      checklistItemId?: string;
      evidenceId?: string;
      body: string;
      parentId?: string;
    },
  ) {
    if (b.checklistItemId) {
      const item = await this.items.findOne({ where: { id: b.checklistItemId } });
      if (!item) throw new NotFoundException('Checklist item not found');
      await this.projects.assertAccess(
        item.projectId,
        req.user.userId,
        req.user.role,
      );
    }
    return this.repo.save(
      this.repo.create({
        checklistItemId: b.checklistItemId,
        evidenceId: b.evidenceId,
        userId: req.user.userId,
        body: b.body,
        parentId: b.parentId,
      }),
    );
  }
}
