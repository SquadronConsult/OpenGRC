import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FrmrIngestionService } from '../frmr/frmr-ingestion.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly ds: DataSource,
    private readonly frmr: FrmrIngestionService,
  ) {}

  @Get()
  async live() {
    const latest = await this.frmr.getLatestVersion();
    return {
      status: 'ok',
      service: 'grc-api',
      frmrLoaded: !!latest,
    };
  }

  @Get('ready')
  async ready() {
    await this.ds.query('SELECT 1');
    const latest = await this.frmr.getLatestVersion();
    return { ready: true, frmrLoaded: !!latest };
  }
}
