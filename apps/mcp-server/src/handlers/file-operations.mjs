import {
  assertSafeFileForWrite,
  assertStepBudget,
  assertFileCountBudget,
} from '../utils/guardrails.mjs';
import { createRunId, appendRunEvent } from '../utils/audit.mjs';
import { config } from '../config.mjs';
import {
  resolveWorkspaceRoot,
  resolveTargetPath,
  textResult,
  collectUniquePaths,
  runSessions,
  applySingleChange,
  rollbackRun,
  runValidationCommands,
} from '../helpers.mjs';

export const tools = [
  {
    name: 'apply_remediation_v1',
    description:
      'Apply bounded file edits with guardrails, audit logs, and rollback checkpointing.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['changes'],
      properties: {
        workspacePath: {
          type: 'string',
          description: 'Absolute workspace root path for relative change paths',
        },
        runId: { type: 'string' },
        dryRun: { type: 'boolean', default: false },
        changes: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['path', 'action'],
            properties: {
              path: { type: 'string' },
              action: { type: 'string', enum: ['replace', 'append', 'overwrite'] },
              findText: { type: 'string' },
              content: { type: 'string' },
            },
          },
        },
      },
    },
  },
  {
    name: 'dry_run_remediation_v1',
    description:
      'Validate remediation change set against guardrails without writing files.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['changes'],
      properties: {
        workspacePath: {
          type: 'string',
          description: 'Absolute workspace root path for relative change paths',
        },
        changes: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['path', 'action'],
            properties: {
              path: { type: 'string' },
              action: { type: 'string', enum: ['replace', 'append', 'overwrite'] },
              findText: { type: 'string' },
              content: { type: 'string' },
            },
          },
        },
      },
    },
  },
  {
    name: 'validate_remediation_v1',
    description: 'Run safe validation commands (allowlisted) against workspace changes.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        workspacePath: {
          type: 'string',
          description: 'Absolute workspace root path for command execution',
        },
        commands: {
          type: 'array',
          items: { type: 'string' },
          default: ['npm run build'],
        },
      },
    },
  },
  {
    name: 'rollback_run_v1',
    description: 'Rollback all tracked file edits for a run checkpoint.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['runId'],
      properties: {
        runId: { type: 'string' },
      },
    },
  },
];

export async function handle(name, args) {
  if (name === 'apply_remediation_v1') {
    const workspaceRoot = resolveWorkspaceRoot(args);
    const changes = Array.isArray(args.changes) ? args.changes : [];
    assertStepBudget(changes.length);
    assertFileCountBudget(collectUniquePaths(changes).length);
    const runId = args.runId || createRunId();
    const dryRun = args.dryRun ?? config.dryRunDefault;
    const backups = runSessions.get(runId)?.backups || new Map();
    runSessions.set(runId, { backups, workspaceRoot, createdAt: new Date().toISOString() });
    await appendRunEvent(runId, {
      type: 'run_started',
      dryRun,
      steps: changes.length,
      workspaceRoot,
    });

    if (!dryRun) {
      for (const change of changes) {
        await applySingleChange(change, runId, backups, workspaceRoot);
      }
    }

    await appendRunEvent(runId, {
      type: 'run_completed',
      changedFiles: collectUniquePaths(changes),
    });
    return textResult({
      runId,
      dryRun,
      appliedSteps: changes.length,
      changedFiles: collectUniquePaths(changes),
    });
  }

  if (name === 'dry_run_remediation_v1') {
    const workspaceRoot = resolveWorkspaceRoot(args);
    const changes = Array.isArray(args.changes) ? args.changes : [];
    assertStepBudget(changes.length);
    assertFileCountBudget(collectUniquePaths(changes).length);
    for (const change of changes) {
      await assertSafeFileForWrite(resolveTargetPath(workspaceRoot, change.path));
    }
    return textResult({
      ok: true,
      dryRun: true,
      workspaceRoot,
      checkedSteps: changes.length,
      checkedFiles: collectUniquePaths(changes),
    });
  }

  if (name === 'validate_remediation_v1') {
    const workspaceRoot = resolveWorkspaceRoot(args);
    const commands =
      Array.isArray(args.commands) && args.commands.length
        ? args.commands
        : ['npm run build'];
    const results = await runValidationCommands(commands, workspaceRoot);
    return textResult({
      workspace: workspaceRoot,
      results,
    });
  }

  if (name === 'rollback_run_v1') {
    const result = await rollbackRun(args.runId);
    return textResult(result);
  }

  return null;
}
