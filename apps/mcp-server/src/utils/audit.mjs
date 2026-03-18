import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '../config.mjs';
import { redactSecrets } from './guardrails.mjs';

export async function ensureAuditDirs() {
  await fs.mkdir(path.join(config.dataDir, 'runs'), { recursive: true });
}

export function createRunId() {
  return randomUUID();
}

export async function appendRunEvent(runId, event) {
  await ensureAuditDirs();
  const outPath = path.join(config.dataDir, 'runs', `${runId}.jsonl`);
  const row = {
    ts: new Date().toISOString(),
    ...event,
  };
  const serialized = redactSecrets(JSON.stringify(row));
  await fs.appendFile(outPath, `${serialized}\n`, 'utf8');
}

export async function readRunLog(runId) {
  const outPath = path.join(config.dataDir, 'runs', `${runId}.jsonl`);
  const raw = await fs.readFile(outPath, 'utf8').catch(() => '');
  if (!raw) return [];
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { parseError: true, line };
      }
    });
}
