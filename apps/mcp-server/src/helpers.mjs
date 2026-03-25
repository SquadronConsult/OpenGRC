import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { config } from './config.mjs';
import { assertSafeFileForWrite } from './utils/guardrails.mjs';
import { appendRunEvent } from './utils/audit.mjs';

export const execFileAsync = promisify(execFile);

/** Per-run rollback checkpoints (shared across handlers). */
export const runSessions = new Map();

export function resolveWorkspaceRoot(args = {}) {
  const requested = typeof args.workspacePath === 'string' ? args.workspacePath.trim() : '';
  if (!requested) return config.workspaceRoot;
  return path.resolve(requested);
}

export function resolveTargetPath(workspaceRoot, maybeRelativePath) {
  if (!maybeRelativePath) return workspaceRoot;
  if (path.isAbsolute(maybeRelativePath)) return path.resolve(maybeRelativePath);
  return path.resolve(workspaceRoot, maybeRelativePath);
}

export function textResult(payload) {
  return {
    content: [
      {
        type: 'text',
        text: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export function errorResult(message) {
  return {
    content: [{ type: 'text', text: `ERROR: ${message}` }],
    isError: true,
  };
}

export function collectUniquePaths(changes = []) {
  return [...new Set(changes.map((c) => c.path))];
}

export function summarizeRisk(change) {
  const action = String(change.action || 'replace');
  if (action === 'overwrite') return 'high';
  if (action === 'append') return 'low';
  return 'medium';
}

export async function applySingleChange(change, runId, backups, workspaceRoot) {
  const resolved = await assertSafeFileForWrite(
    resolveTargetPath(workspaceRoot, change.path),
  );
  let original = '';
  let exists = true;
  try {
    original = await fs.readFile(resolved, 'utf8');
  } catch {
    exists = false;
  }
  if (!backups.has(resolved)) {
    backups.set(resolved, { exists, content: original });
  }

  const action = String(change.action || 'replace');
  let nextContent = original;
  if (action === 'overwrite') {
    nextContent = String(change.content || '');
  } else if (action === 'append') {
    nextContent = `${original}${String(change.content || '')}`;
  } else if (action === 'replace') {
    if (!change.findText) {
      throw new Error(`replace action requires findText for ${change.path}`);
    }
    if (!original.includes(change.findText)) {
      throw new Error(`findText not found in ${change.path}`);
    }
    nextContent = original.replace(change.findText, String(change.content || ''));
  } else {
    throw new Error(`Unsupported action: ${action}`);
  }

  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, nextContent, 'utf8');
  await appendRunEvent(runId, {
    type: 'file_change',
    path: change.path,
    action,
    risk: summarizeRisk(change),
  });
}

export async function rollbackRun(runId) {
  const session = runSessions.get(runId);
  if (!session) {
    throw new Error(`No run session found for ${runId}`);
  }
  for (const [filePath, backup] of session.backups.entries()) {
    if (!backup.exists) {
      await fs.rm(filePath, { force: true });
    } else {
      await fs.writeFile(filePath, backup.content, 'utf8');
    }
  }
  await appendRunEvent(runId, {
    type: 'rollback_complete',
    restoredFiles: session.backups.size,
  });
  return { runId, restoredFiles: session.backups.size };
}

export function isCommandAllowed(cmd) {
  const allow = [
    /^npm run (test|build|lint|smoke)/i,
    /^pnpm (test|build|lint)/i,
    /^yarn (test|build|lint)/i,
    /^python -m pytest/i,
    /^go test/i,
    /^ruff check/i,
    /^trivy (fs|config)/i,
  ];
  return allow.some((rx) => rx.test(cmd.trim()));
}

export async function runValidationCommands(commands = [], workspaceRoot = config.workspaceRoot) {
  const results = [];
  const isWin = process.platform === 'win32';
  for (const cmd of commands) {
    if (!isCommandAllowed(cmd)) {
      results.push({
        command: cmd,
        ok: false,
        skipped: true,
        reason: 'Command blocked by policy allowlist',
      });
      continue;
    }
    try {
      const { stdout, stderr } = isWin
        ? await execFileAsync(
            process.env.ComSpec || 'cmd.exe',
            ['/d', '/s', '/c', cmd],
            {
              cwd: workspaceRoot,
              timeout: config.commandTimeoutMs,
              maxBuffer: 1024 * 1024 * 8,
            },
          )
        : await execFileAsync('bash', ['-lc', cmd], {
            cwd: workspaceRoot,
            timeout: config.commandTimeoutMs,
            maxBuffer: 1024 * 1024 * 8,
          });
      results.push({
        command: cmd,
        ok: true,
        stdout: String(stdout || '').slice(0, 4000),
        stderr: String(stderr || '').slice(0, 2000),
      });
    } catch (e) {
      results.push({
        command: cmd,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}
