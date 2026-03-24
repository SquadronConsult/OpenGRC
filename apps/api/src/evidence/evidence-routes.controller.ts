import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { existsSync } from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EvidenceItem } from '../entities/evidence-item.entity';
import { ProjectsService } from '../projects/projects.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';

@Controller('evidence')
@UseGuards(JwtAuthGuard)
export class EvidenceRoutesController {
  constructor(
    @InjectRepository(EvidenceItem) private readonly ev: Repository<EvidenceItem>,
    private readonly projects: ProjectsService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly ds: DataSource,
  ) {}

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @Req() req: { user: { userId: string; role: string } },
    @Query('redirect') redirect?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const row = await this.ev.findOne({
      where: { id },
      relations: ['checklistItem'],
    });
    if (!row) throw new BadRequestException('Evidence not found');
    const item = row.checklistItem;
    if (!item) throw new BadRequestException('Checklist item missing');
    await this.projects.assertAccess(
      item.projectId,
      req.user.userId,
      req.user.role,
    );
    if (!row.storageKey && row.externalUri) {
      if (redirect === 'true' && res) {
        return res.redirect(row.externalUri);
      }
      return { externalUri: row.externalUri };
    }
    if (!row.storageKey) throw new BadRequestException('No file storage');
    const url = await this.storage.getSignedDownloadUrl(row.storageKey);
    if (url.startsWith('http')) {
      if (redirect === 'true' && res) return res.redirect(url);
      return {
        url,
        expiresInSeconds: this.storage.getSignedUrlExpirySeconds(),
      };
    }
    const localPath = this.storage.getLocalAbsolutePath(row.storageKey);
    if (!existsSync(localPath)) {
      throw new BadRequestException('File not found on disk');
    }
    await this.audit.log(req.user.userId, 'evidence.download', 'evidence', id, {});
    if (res) {
      return res.download(localPath, row.filename || 'evidence');
    }
    return { path: localPath };
  }

  @Patch('bulk-review')
  async bulkReview(
    @Req() req: { user: { userId: string; role: string } },
    @Body() b: { ids: string[]; reviewState: string },
  ) {
    const updated: EvidenceItem[] = [];
    await this.ds.transaction(async (em) => {
      for (const id of b.ids || []) {
        const row = await em.findOne(EvidenceItem, {
          where: { id },
          relations: ['checklistItem'],
        });
        if (!row?.checklistItem) continue;
        await this.projects.assertAccess(
          row.checklistItem.projectId,
          req.user.userId,
          req.user.role,
        );
        if (
          row.uploadedById &&
          row.uploadedById === req.user.userId
        ) {
          throw new ForbiddenException(
            'Segregation: uploader cannot review own evidence',
          );
        }
        row.reviewState = b.reviewState;
        await em.save(row);
        updated.push(row);
        await this.audit.log(req.user.userId, 'evidence.bulk_review', 'evidence', id, {
          reviewState: b.reviewState,
        });
      }
    });
    return { updated: updated.length, items: updated };
  }
}
