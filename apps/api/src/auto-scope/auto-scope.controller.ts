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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AutoScopeService } from './auto-scope.service';
import { AutoScopeRunOptions } from './auto-scope.types';
import { AutoScopeRecommendationListQueryDto } from './dto/recommendation-list-query.dto';
import { skipTakeFromPageLimit } from '../common/dto/page-limit-query.dto';
import { parseSortParam } from '../common/sort/parse-sort';

@ApiTags('auto-scope')
@Controller('projects/:projectId/auto-scope')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class AutoScopeController {
  constructor(private readonly autoScope: AutoScopeService) {}

  @Post('run')
  @ApiOperation({ summary: 'Run auto-scope' })
  async run(
    @Param('projectId') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() body: AutoScopeRunOptions,
  ) {
    return this.autoScope.run(projectId, req.user.userId, req.user.role, body || {});
  }

  @Post('preflight')
  @ApiOperation({ summary: 'Auto-scope preflight' })
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
  @ApiOperation({ summary: 'List auto-scope recommendations (paginated)' })
  async list(
    @Param('projectId') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Query() q: AutoScopeRecommendationListQueryDto,
  ) {
    const paging = skipTakeFromPageLimit(q);
    const sort = parseSortParam(
      q.sort ?? '-createdAt',
      { createdAt: 'r.created_at', confidence: 'r.confidence' },
      'createdAt',
    );
    return this.autoScope.listRecommendations(
      projectId,
      req.user.userId,
      req.user.role,
      {
        status: q.status,
        decision: q.decision,
        runId: q.runId,
        minConfidence: q.minConfidence,
      },
      paging,
      sort,
    );
  }

  @Post('recommendations/:recommendationId/approve')
  @ApiOperation({ summary: 'Approve recommendation' })
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
  @ApiOperation({ summary: 'Reject recommendation' })
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
  @ApiOperation({ summary: 'Bulk approve recommendations' })
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
