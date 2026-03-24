import {
  BadRequestException,
  Controller,
  NotFoundException,
  Post,
  Param,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChecklistItem } from '../entities/checklist-item.entity';
import { EvidenceItem } from '../entities/evidence-item.entity';
import { ProjectsService } from '../projects/projects.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { WebhooksService } from '../webhooks/webhooks.service';

@Controller('checklist-items')
@UseGuards(JwtAuthGuard)
export class EvidenceController {
  constructor(
    @InjectRepository(ChecklistItem) private readonly items: Repository<ChecklistItem>,
    @InjectRepository(EvidenceItem) private readonly ev: Repository<EvidenceItem>,
    private readonly projects: ProjectsService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly webhooks: WebhooksService,
  ) {}

  @Post(':id/evidence')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Param('id') checklistItemId: string,
    @Req() req: { user: { userId: string; role: string } },
    @UploadedFile() file: Express.Multer.File,
    @Body() b: { externalUri?: string },
  ) {
    const item = await this.items.findOne({ where: { id: checklistItemId } });
    if (!item) throw new NotFoundException('Checklist item not found');
    await this.projects.assertAccess(
      item.projectId,
      req.user.userId,
      req.user.role,
    );
    let storageKey: string | null = null;
    let checksum: string | null = null;
    let filename: string | null = null;
    if (file?.buffer?.length) {
      const up = await this.storage.uploadEvidence(
        item.projectId,
        file.originalname,
        file.buffer,
        file.mimetype,
      );
      storageKey = up.key;
      checksum = up.checksum;
      filename = file.originalname;
      const dup = await this.ev.findOne({
        where: { checklistItemId, checksum },
      });
      if (dup) {
        return {
          ...dup,
          duplicate: true,
          message:
            'Same SHA-256 checksum already uploaded for this checklist item; returning existing evidence record.',
        };
      }
    } else if (!b.externalUri) {
      throw new BadRequestException('Provide file or externalUri');
    }
    const row = new EvidenceItem();
    row.checklistItemId = checklistItemId;
    row.storageKey = storageKey;
    row.filename = filename;
    row.checksum = checksum;
    row.externalUri = b.externalUri || null;
    row.uploadedById = req.user.userId;
    await this.ev.save(row);
    await this.audit.log(
      req.user.userId,
      'evidence.upload',
      'evidence',
      row.id,
      { checklistItemId },
    );
    await this.webhooks.deliver(item.projectId, 'evidence.uploaded', {
      evidenceId: row.id,
      checklistItemId,
    });
    return row;
  }
}
