import {
  NotFoundException,
  Body,
  Controller,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChecklistItem } from '../entities/checklist-item.entity';
import { ProjectsService } from '../projects/projects.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { PatchChecklistItemDto } from './dto/patch-checklist-item.dto';

@ApiTags('checklist-items')
@Controller('checklist-items')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class ChecklistItemsController {
  constructor(
    @InjectRepository(ChecklistItem) private readonly repo: Repository<ChecklistItem>,
    private readonly projects: ProjectsService,
    private readonly webhooks: WebhooksService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  @Patch(':id')
  @ApiOperation({ summary: 'Update checklist item' })
  async patch(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() b: PatchChecklistItemDto,
  ) {
    const item = await this.repo.findOne({
      where: { id },
      relations: ['project'],
    });
    if (!item) throw new NotFoundException('Checklist item not found');
    await this.projects.assertAccess(
      item.projectId,
      req.user.userId,
      req.user.role,
    );
    const prev = { ...item };
    if (b.status != null) item.status = b.status;
    if (b.ownerUserId !== undefined) item.ownerUserId = b.ownerUserId || null;
    if (b.dueDate !== undefined)
      item.dueDate = b.dueDate ? new Date(b.dueDate) : null;
    if (b.reviewState !== undefined) item.reviewState = b.reviewState;
    await this.repo.save(item);
    if (b.ownerUserId && b.ownerUserId !== prev.ownerUserId) {
      await this.notifications.notify(b.ownerUserId, 'task.assigned', {
        checklistItemId: id,
        projectId: item.projectId,
      });
    }
    await this.webhooks.deliver(item.projectId, 'checklist.updated', {
      checklistItemId: id,
      changes: b,
    });
    await this.audit.log(
      req.user.userId,
      'checklist.update',
      'checklist_item',
      id,
      { ...b },
    );
    return item;
  }
}
