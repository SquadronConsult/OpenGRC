import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AutoScopeService } from './auto-scope.service';
import { AutoScopeRunOptions } from './auto-scope.types';

@Controller('projects/:projectId/auto-scope')
@UseGuards(JwtAuthGuard)
export class AutoScopeController {
  constructor(private readonly autoScope: AutoScopeService) {}

  @Post('run')
  async run(
    @Param('projectId') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() body: AutoScopeRunOptions,
  ) {
    return this.autoScope.run(projectId, req.user.userId, req.user.role, body || {});
  }

  @Post('preflight')
  async preflight(
    @Param('projectId') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() body: AutoScopeRunOptions,
  ) {
    return this.autoScope.preflight(
      projectId,
      req.user.userId,
      req.user.role,
      body || {},
    );
  }

  @Get('recommendations')
  async list(
    @Param('projectId') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Query('status') status?: string,
    @Query('decision') decision?: string,
    @Query('runId') runId?: string,
    @Query('minConfidence') minConfidence?: string,
  ) {
    return this.autoScope.listRecommendations(projectId, req.user.userId, req.user.role, {
      status,
      decision,
      runId,
      minConfidence:
        minConfidence != null && minConfidence !== ''
          ? parseFloat(minConfidence)
          : undefined,
    });
  }

  @Post('recommendations/:recommendationId/approve')
  async approve(
    @Param('projectId') projectId: string,
    @Param('recommendationId') recommendationId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() body: { notes?: string },
  ) {
    return this.autoScope.approveRecommendation(
      projectId,
      recommendationId,
      req.user.userId,
      req.user.role,
      body?.notes,
    );
  }

  @Post('recommendations/:recommendationId/reject')
  async reject(
    @Param('projectId') projectId: string,
    @Param('recommendationId') recommendationId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() body: { notes?: string },
  ) {
    return this.autoScope.rejectRecommendation(
      projectId,
      recommendationId,
      req.user.userId,
      req.user.role,
      body?.notes,
    );
  }

  @Post('recommendations/bulk-approve')
  async bulkApprove(
    @Param('projectId') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() body: { recommendationIds: string[]; notes?: string },
  ) {
    return this.autoScope.bulkApprove(
      projectId,
      body?.recommendationIds || [],
      req.user.userId,
      req.user.role,
      body?.notes,
    );
  }
}
