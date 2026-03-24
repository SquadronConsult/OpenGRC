import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('dashboard/stats')
  getGlobalStats() {
    return this.dashboard.getStats();
  }

  @Get('projects/:id/stats')
  getProjectStats(@Param('id') id: string) {
    return this.dashboard.getStats(id);
  }

  @Get('activity/recent')
  getRecentActivity(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.dashboard.getRecentActivity(limit);
  }
}
