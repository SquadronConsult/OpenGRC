import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.mjs';

const forbiddenPathPatterns = [
  /(^|[\\/])\.env(\.|$)/i,
  /(^|[\\/])id_rsa(\.|$)/i,
  /(^|[\\/])credentials(\.|$)/i,
  /(^|[\\/])secrets?(\.|$)/i,
  /(^|[\\/])\.git[\\/]/i,
];

export function redactSecrets(input) {
  const txt = typeof input === 'string' ? input : JSON.stringify(input);
  return txt
    .replace(/(AKIA[0-9A-Z]{16})/g, 'AKIA****************')
    .replace(/(ASIA[0-9A-Z]{16})/g, 'ASIA****************')
    .replace(/(AIza[0-9A-Za-z\\-_]{35})/g, 'AIza***********************')
    .replace(
      /(-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (RSA |EC |OPENSSH )?PRIVATE KEY-----)/g,
      '[REDACTED_PRIVATE_KEY]',
    )
    .replace(/(password|secret|token|key)\s*[:=]\s*["']?[^"'\s]+["']?/gi, '$1=[REDACTED]');
}

export function assertWithinAllowedPath(inputPath) {
  const resolved = path.resolve(inputPath);
  const inAllowed = config.allowAllPaths
    ? true
    : config.allowedPaths.some((root) => {
        const rel = path.relative(root, resolved);
        return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
      });
  if (!inAllowed) {
    throw new Error(`Path is outside allowed roots: ${resolved}`);
  }
  if (forbiddenPathPatterns.some((p) => p.test(resolved))) {
    throw new Error(`Path is blocked by guardrails: ${resolved}`);
  }
  return resolved;
}

export async function assertSafeFileForWrite(resolvedPath) {
  const safePath = assertWithinAllowedPath(resolvedPath);
  const ext = path.extname(safePath).toLowerCase();
  const blockedExt = ['.pem', '.key', '.crt', '.p12', '.jks', '.kdbx'];
  if (blockedExt.includes(ext)) {
    throw new Error(`Blocked sensitive file extension: ${ext}`);
  }
  try {
    const st = await fs.stat(safePath);
    if (st.size > config.maxFileBytes) {
      throw new Error(`File exceeds max size guardrail (${config.maxFileBytes} bytes)`);
    }
  } catch {
    // new files are allowed
  }
  return safePath;
}

export function assertStepBudget(count) {
  if (count > config.maxStepsPerRun) {
    throw new Error(
      `Step budget exceeded. Requested ${count}, max ${config.maxStepsPerRun}`,
    );
  }
}

export function assertFileCountBudget(count) {
  if (count > config.maxFilesPerRun) {
    throw new Error(
      `File count budget exceeded. Requested ${count}, max ${config.maxFilesPerRun}`,
    );
  }
}
