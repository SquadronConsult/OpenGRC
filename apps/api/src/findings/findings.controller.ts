import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FindingListQueryDto } from './dto/finding-list-query.dto';
import { FindingsService } from './findings.service';

@ApiTags('findings')
@Controller('findings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class FindingsController {
  constructor(private readonly findings: FindingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create finding' })
  async create(
    @Req() req: { user: { userId: string; role: string } },
    @Body()
    b: {
      checklistItemId: string;
      title: string;
      description?: string;
      severity?: string;
    },
  ) {
    return this.findings.create(req.user.userId, req.user.role, b);
  }

  @Get('by-checklist/:checklistItemId')
  @ApiOperation({ summary: 'List findings by checklist item (paginated)' })
  async list(
    @Param('checklistItemId') cid: string,
    @Req() req: { user: { userId: string; role: string } },
    @Query() q: FindingListQueryDto,
  ) {
    return this.findings.listByChecklist(cid, req.user.userId, req.user.role, q);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update finding' })
  async patch(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() b: { status?: string; remediationNotes?: string },
  ) {
    return this.findings.patch(id, req.user.userId, req.user.role, b);
  }
}
