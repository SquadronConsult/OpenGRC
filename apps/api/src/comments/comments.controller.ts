import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from '../entities/comment.entity';
import { ChecklistItem } from '../entities/checklist-item.entity';
import { ProjectsService } from '../projects/projects.service';
import { CommentListQueryDto } from './dto/comment-list-query.dto';
import { skipTakeFromPageLimit } from '../common/dto/page-limit-query.dto';
import { parseSortParam } from '../common/sort/parse-sort';
import { toPaginated } from '../common/pagination/paginated-result';

@ApiTags('comments')
@Controller('comments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class CommentsController {
  constructor(
    @InjectRepository(Comment) private readonly repo: Repository<Comment>,
    @InjectRepository(ChecklistItem) private readonly items: Repository<ChecklistItem>,
    private readonly projects: ProjectsService,
  ) {}

  @Get('checklist/:checklistItemId')
  @ApiOperation({ summary: 'List comments for checklist item (paginated)' })
  async list(
    @Param('checklistItemId') cid: string,
    @Req() req: { user: { userId: string; role: string } },
    @Query() q: CommentListQueryDto,
  ) {
    const item = await this.items.findOne({ where: { id: cid } });
    if (!item) throw new NotFoundException('Checklist item not found');
    await this.projects.assertAccess(
      item.projectId,
      req.user.userId,
      req.user.role,
    );
    const paging = skipTakeFromPageLimit(q);
    const sort = parseSortParam(q.sort, { createdAt: 'c.created_at', id: 'c.id' }, 'createdAt');
    const qb = this.repo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'user')
      .where('c.checklistItemId = :cid', { cid });
    const total = await qb.getCount();
    const rows = await qb
      .clone()
      .orderBy(sort.column, sort.order)
      .skip(paging.skip)
      .take(paging.take)
      .getMany();
    return toPaginated(rows, paging.page, paging.limit, total);
  }

  @Post()
  @ApiOperation({ summary: 'Create comment' })
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
