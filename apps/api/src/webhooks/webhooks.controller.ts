import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WebhooksService } from './webhooks.service';
import { ProjectsService } from '../projects/projects.service';

@Controller('webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(
    private readonly svc: WebhooksService,
    private readonly projects: ProjectsService,
  ) {}

  @Get()
  list(@Req() req: { user: { role: string } }) {
    if (req.user.role !== 'admin') return [];
    return this.svc.list();
  }

  @Post()
  async create(
    @Req() req: { user: { userId: string; role: string } },
    @Body() b: { url: string; secret?: string; events: string[]; projectId?: string },
  ) {
    if (!b.url || !Array.isArray(b.events) || b.events.length === 0) {
      throw new BadRequestException('url and events[] are required');
    }
    if (req.user.role !== 'admin') {
      if (!b.projectId) {
        throw new ForbiddenException('Non-admin webhook must target a project');
      }
      await this.projects.assertAccess(b.projectId, req.user.userId, req.user.role);
    }
    return this.svc.create({
      url: b.url,
      secret: b.secret,
      events: b.events,
      projectId: b.projectId,
    });
  }
}
