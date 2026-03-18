import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly ds: DataSource) {}

  @Get()
  live() {
    return { status: 'ok', service: 'grc-api' };
  }

  @Get('ready')
  async ready() {
    await this.ds.query('SELECT 1');
    return { ready: true };
  }
}
