import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WebhooksService } from './webhooks.service';
import { ProjectsService } from '../projects/projects.service';
import { PageLimitQueryDto } from '../common/dto/page-limit-query.dto';
import { skipTakeFromPageLimit } from '../common/dto/page-limit-query.dto';
import { toPaginated } from '../common/pagination/paginated-result';

@ApiTags('webhooks')
@Controller('webhooks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class WebhooksController {
  constructor(
    private readonly svc: WebhooksService,
    private readonly projects: ProjectsService,
  ) {}

  @Get()
  list(
    @Req() req: { user: { role: string } },
    @Query() q: PageLimitQueryDto,
  ) {
    const paging = skipTakeFromPageLimit(q);
    if (req.user.role !== 'admin') {
      return toPaginated([], paging.page, paging.limit, 0);
    }
    return this.svc.listPaginated(undefined, paging);
  }

  @Post()
  @ApiOperation({ summary: 'Create webhook subscription' })
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
