import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly log = new Logger(StorageService.name);
  private baseDir: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const configured = this.config.get<string>('EVIDENCE_DIR');
    this.baseDir = configured || join(process.cwd(), 'evidence');
  }

  async ensureBucket(): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    this.log.log(`Evidence directory ready: ${this.baseDir}`);
  }

  async uploadEvidence(
    projectId: string,
    filename: string,
    body: Buffer,
    contentType?: string,
  ): Promise<{ key: string; checksum: string }> {
    const checksum = createHash('sha256').update(body).digest('hex');
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `projects/${projectId}/${Date.now()}-${safeName}`;
    const target = join(this.baseDir, key);
    await mkdir(join(this.baseDir, 'projects', projectId), {
      recursive: true,
    });
    await writeFile(target, body);
    if (contentType) {
      await writeFile(`${target}.meta`, JSON.stringify({ contentType }, null, 2));
    }
    return { key, checksum };
  }

  async getSignedDownloadUrl(key: string): Promise<string> {
    // Desktop/local mode does not require signed URLs.
    return `file://${join(this.baseDir, key).replace(/\\/g, '/')}`;
  }
}
