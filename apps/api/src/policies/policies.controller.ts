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
import { PolicyService } from './policy.service';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { POLICY_TEMPLATES, getTemplateBySlug } from './policy-templates';

@ApiTags('policies')
@Controller('policies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class PoliciesController {
  constructor(private readonly policies: PolicyService) {}

  @Get()
  @ApiOperation({ summary: 'List policies' })
  async list(
    @Req() req: { user: { userId: string; role: string } },
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
  ) {
    return this.policies.list(req.user.userId, req.user.role, projectId, status);
  }

  @Get('templates')
  @ApiOperation({ summary: 'List available policy templates' })
  async listTemplates() {
    return POLICY_TEMPLATES.map((t) => ({
      slug: t.slug,
      title: t.title,
      category: t.category,
      controlFamilies: t.controlFamilies,
    }));
  }

  @Get('templates/:slug')
  @ApiOperation({ summary: 'Get a single policy template with full content' })
  async getTemplate(@Param('slug') slug: string) {
    const tpl = getTemplateBySlug(slug);
    if (!tpl)
      throw new (await import('@nestjs/common')).NotFoundException(
        `Template "${slug}" not found`,
      );
    return tpl;
  }

  @Post()
  @ApiOperation({ summary: 'Create policy' })
  async create(
    @Req() req: { user: { userId: string; role: string } },
    @Body() dto: CreatePolicyDto,
  ) {
    return this.policies.create(req.user.userId, req.user.role, dto);
  }

  @Post('generate')
  @ApiOperation({
    summary: 'Generate policies from templates for a project',
  })
  async generate(
    @Req() req: { user: { userId: string; role: string } },
    @Body()
    body: {
      projectId: string;
      slugs?: string[];
      organizationName?: string;
      systemName?: string;
    },
  ) {
    return this.policies.generateFromTemplates(
      req.user.userId,
      req.user.role,
      body.projectId,
      body.slugs,
      body.organizationName,
      body.systemName,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get policy' })
  async get(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    return this.policies.getById(id, req.user.userId, req.user.role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update policy' })
  async patch(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() dto: UpdatePolicyDto,
  ) {
    return this.policies.update(id, req.user.userId, req.user.role, dto);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish policy (snapshot version)' })
  async publish(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() b: { changeDescription?: string },
  ) {
    return this.policies.publish(
      id,
      req.user.userId,
      req.user.role,
      b?.changeDescription,
    );
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List policy versions' })
  async versions(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    return this.policies.listVersions(id, req.user.userId, req.user.role);
  }

  @Post(':id/control-mappings')
  @ApiOperation({ summary: 'Replace control mappings' })
  async mappings(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() b: { catalogRequirementIds?: string[]; internalControlIds?: string[] },
  ) {
    return this.policies.setControlMappings(
      id,
      req.user.userId,
      req.user.role,
      b ?? {},
    );
  }

  @Post(':id/attest/request')
  @ApiOperation({ summary: 'Request attestations' })
  async requestAttest(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() b: { userIds: string[]; expiresAt?: string },
  ) {
    return this.policies.requestAttestation(
      id,
      req.user.userId,
      req.user.role,
      b.userIds,
      b.expiresAt,
    );
  }

  @Post(':id/attest')
  @ApiOperation({ summary: 'Submit attestation' })
  async attest(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
    @Body() b: { acknowledge?: boolean },
  ) {
    return this.policies.attest(
      id,
      req.user.userId,
      req.user.role,
      b?.acknowledge !== false,
    );
  }
}
