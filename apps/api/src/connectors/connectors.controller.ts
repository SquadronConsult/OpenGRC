import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConnectorInstanceService } from './connector-instance.service';
import { CreateConnectorInstanceDto, UpdateConnectorInstanceDto } from './dto/connector-instance.dto';

@ApiTags('connectors')
@Controller('projects/:projectId/connectors')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class ConnectorsController {
  constructor(private readonly connectors: ConnectorInstanceService) {}

  @Get('registry')
  @ApiOperation({ summary: 'List connector registry (metadata)' })
  listRegistry(@Req() req: { user: { userId: string; role: string } }) {
    void req;
    return this.connectors.listRegistry();
  }

  @Get('status/summary')
  @ApiOperation({ summary: 'Project connector status summary' })
  projectStatus(
    @Param('projectId') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    return this.connectors.projectConnectorStatus(
      projectId,
      req.user.userId,
      req.user.role,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List connector instances' })
  list(
    @Param('projectId') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    return this.connectors.listInstances(projectId, req.user.userId, req.user.role);
  }

  @Get(':instanceId/runs')
  @ApiOperation({ summary: 'List runs for connector instance' })
  @ApiQuery({ name: 'limit', required: false })
  runs(
    @Param('projectId') projectId: string,
    @Param('instanceId') instanceId: string,
    @Query('limit') limit: string | undefined,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    const n = limit ? parseInt(limit, 10) : 20;
    return this.connectors.listRuns(
      projectId,
      instanceId,
      req.user.userId,
      req.user.role,
      Number.isFinite(n) ? n : 20,
    );
  }

  @Get(':instanceId')
  @ApiOperation({ summary: 'Get connector instance' })
  getOne(
    @Param('projectId') projectId: string,
    @Param('instanceId') instanceId: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    return this.connectors.getInstance(
      projectId,
      instanceId,
      req.user.userId,
      req.user.role,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create connector instance' })
  create(
    @Param('projectId') projectId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() body: CreateConnectorInstanceDto,
  ) {
    return this.connectors.createInstance(
      projectId,
      body,
      req.user.userId,
      req.user.role,
    );
  }

  @Patch(':instanceId')
  @ApiOperation({ summary: 'Update connector instance' })
  update(
    @Param('projectId') projectId: string,
    @Param('instanceId') instanceId: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() body: UpdateConnectorInstanceDto,
  ) {
    return this.connectors.updateInstance(
      projectId,
      instanceId,
      body,
      req.user.userId,
      req.user.role,
    );
  }

  @Delete(':instanceId')
  @ApiOperation({ summary: 'Delete connector instance' })
  remove(
    @Param('projectId') projectId: string,
    @Param('instanceId') instanceId: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    return this.connectors.deleteInstance(
      projectId,
      instanceId,
      req.user.userId,
      req.user.role,
    );
  }

  @Post(':instanceId/run')
  @ApiOperation({ summary: 'Trigger connector run' })
  run(
    @Param('projectId') projectId: string,
    @Param('instanceId') instanceId: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    return this.connectors.triggerRun(
      projectId,
      instanceId,
      req.user.userId,
      req.user.role,
    );
  }
}
