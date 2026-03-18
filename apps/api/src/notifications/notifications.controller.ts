import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  list(@Req() req: { user: { userId: string } }) {
    return this.svc.listForUser(req.user.userId);
  }

  @Patch(':id/read')
  markRead(
    @Param('id') id: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.svc.markRead(id, req.user.userId);
  }
}
