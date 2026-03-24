import { Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { PageLimitQueryDto } from '../common/dto/page-limit-query.dto';
import { skipTakeFromPageLimit } from '../common/dto/page-limit-query.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for current user (paginated)' })
  list(
    @Req() req: { user: { userId: string } },
    @Query() q: PageLimitQueryDto,
  ) {
    const paging = skipTakeFromPageLimit(q);
    return this.svc.listForUserPaginated(req.user.userId, paging);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification read' })
  markRead(
    @Param('id') id: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.svc.markRead(id, req.user.userId);
  }
}
