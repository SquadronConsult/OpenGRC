import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SearchService, SearchResultType } from './search.service';

@ApiTags('search')
@Controller('search')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Full-text search across resources' })
  async search(
    @Req() req: { user: { userId: string; role: string } },
    @Query('q') q: string,
    @Query('types') typesRaw?: string,
    @Query('projectId') projectId?: string,
    @Query('limit') limit?: string,
  ) {
    const types = (typesRaw || 'checklist,evidence,risk,policy')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean) as SearchResultType[];
    return this.searchService.search(
      req.user.userId,
      req.user.role,
      q || '',
      types,
      projectId,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
