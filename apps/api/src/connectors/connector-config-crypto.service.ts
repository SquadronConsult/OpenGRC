import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { isSecretConfigKey, parseConfigJson } from './connector-redact';

const ENC_PREFIX = 'enc:v1:';

@Injectable()
export class ConnectorConfigCryptoService {
  private readonly log = new Logger(ConnectorConfigCryptoService.name);
  private readonly key: Buffer | null;

  constructor() {
    const b64 = process.env.CONNECTOR_ENCRYPTION_KEY?.trim();
    if (!b64) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('CONNECTOR_ENCRYPTION_KEY is required in production');
      }
      this.log.warn('CONNECTOR_ENCRYPTION_KEY not set; connector secrets are not encrypted at rest');
      this.key = null;
      return;
    }
    const buf = Buffer.from(b64, 'base64');
    if (buf.length !== 32) {
      throw new Error('CONNECTOR_ENCRYPTION_KEY must be base64-encoded 32 bytes (AES-256)');
    }
    this.key = buf;
  }

  /** Parse stored JSON and decrypt secret fields (AES-256-GCM). */
  decryptConfigJson(raw: string): Record<string, unknown> {
    const parsed = parseConfigJson(raw);
    return this.decryptConfigObject(parsed);
  }

  decryptConfigObject(obj: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && v.startsWith(ENC_PREFIX)) {
        out[k] = this.decryptString(v);
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = this.decryptConfigObject(v as Record<string, unknown>);
      } else if (Array.isArray(v)) {
        out[k] = v.map((item) =>
          item && typeof item === 'object' && !Array.isArray(item)
            ? this.decryptConfigObject(item as Record<string, unknown>)
            : item,
        );
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  encryptConfigObject(obj: Record<string, unknown>): Record<string, unknown> {
    if (!this.key) return obj;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && v.length > 0 && isSecretConfigKey(k) && !v.startsWith(ENC_PREFIX)) {
        out[k] = this.encryptString(v);
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = this.encryptConfigObject(v as Record<string, unknown>);
      } else if (Array.isArray(v)) {
        out[k] = v.map((item) =>
          item && typeof item === 'object' && !Array.isArray(item)
            ? this.encryptConfigObject(item as Record<string, unknown>)
            : item,
        );
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  private encryptString(plain: string): string {
    if (!this.key) return plain;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ENC_PREFIX + Buffer.concat([iv, enc, tag]).toString('base64');
  }

  private decryptString(data: string): string {
    if (!this.key || !data.startsWith(ENC_PREFIX)) return data;
    const buf = Buffer.from(data.slice(ENC_PREFIX.length), 'base64');
    if (buf.length < 12 + 16) {
      this.log.error('Connector config ciphertext too short');
      throw new Error('Invalid encrypted connector configuration');
    }
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(buf.length - 16);
    const enc = buf.subarray(12, buf.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  }
}
