import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly log = new Logger(StorageService.name);
  baseDir: string;
  private backend: 'local' | 's3' = 'local';
  private s3: S3Client | null = null;
  private bucket = '';
  private signedUrlExpirySeconds = 3600;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const configured = this.config.get<string>('EVIDENCE_DIR');
    this.baseDir = configured || join(process.cwd(), 'evidence');
    const be = (this.config.get<string>('STORAGE_BACKEND') || 'local').toLowerCase();
    this.backend = be === 's3' ? 's3' : 'local';
    this.signedUrlExpirySeconds = parseInt(
      this.config.get<string>('STORAGE_SIGNED_URL_EXPIRY_SEC') || '3600',
      10,
    );
    if (this.backend === 's3') {
      const region = this.config.get<string>('S3_REGION') || 'us-east-1';
      const endpoint = this.config.get<string>('S3_ENDPOINT');
      this.bucket = this.config.get<string>('S3_BUCKET') || 'opengrc-evidence';
      this.s3 = new S3Client({
        region,
        ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      });
      this.log.log(`S3 storage: bucket=${this.bucket} endpoint=${endpoint || 'default'}`);
    }
  }

  getSignedUrlExpirySeconds(): number {
    return this.signedUrlExpirySeconds;
  }

  async ensureBucket(): Promise<void> {
    if (this.backend === 's3') return;
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

    if (this.backend === 's3' && this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType || 'application/octet-stream',
        }),
      );
      return { key, checksum };
    }

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
    if (this.backend === 's3' && this.s3) {
      const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      return getSignedUrl(this.s3, cmd, {
        expiresIn: this.signedUrlExpirySeconds,
      });
    }
    return `file://${join(this.baseDir, key).replace(/\\/g, '/')}`;
  }

  getLocalAbsolutePath(key: string): string {
    return join(this.baseDir, key);
  }

  async readLocalFile(key: string): Promise<Buffer> {
    return readFile(this.getLocalAbsolutePath(key));
  }
}
