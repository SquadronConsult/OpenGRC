import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  isInitializeRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { config, MCP_PROTOCOL_VERSION } from './config.mjs';
import {
  assertSafeFileForWrite,
  assertStepBudget,
  assertFileCountBudget,
} from './utils/guardrails.mjs';
import { scanRepoInventory } from './utils/repo.mjs';
import { createRunId, appendRunEvent, readRunLog } from './utils/audit.mjs';
import { enrichGapWithFrmrTargets } from './utils/frmr-mapping.mjs';
import { skillCatalog, selectSkills } from './skills/catalog.mjs';
import {
  syncGrcEvidence,
  createProjectV1,
  getFrmrTaxonomy,
  getCatalogFrameworks,
  exportProjectV1,
  exportPoamV1,
  fedrampOscalReportV1,
  evidenceLinkUpsertV1,
  evidenceLinkBulkIngestV1,
  evidenceLinkLookupControlV1,
  evidenceLinkIngestStatusV1,
  evidenceLinkTriggerAutoScopeV1,
  evidenceLinkMapControlV1,
  evidenceLinkProjectBootstrapVerifyV1,
  connectorsListV1,
  connectorsRegistryV1,
  connectorsStatusV1,
  connectorsRunV1,
  connectorsRunsV1,
  connectorsCreateV1,
  opengrcSearchV1,
  opengrcPoliciesListV1,
} from './utils/opengrc.mjs';

const execFileAsync = promisify(execFile);
const runSessions = new Map();
const transportBySessionId = new Map();

function resolveWorkspaceRoot(args = {}) {
  const requested = typeof args.workspacePath === 'string' ? args.workspacePath.trim() : '';
  if (!requested) return config.workspaceRoot;
  return path.resolve(requested);
}

function resolveTargetPath(workspaceRoot, maybeRelativePath) {
  if (!maybeRelativePath) return workspaceRoot;
  if (path.isAbsolute(maybeRelativePath)) return path.resolve(maybeRelativePath);
  return path.resolve(workspaceRoot, maybeRelativePath);
}

function textResult(payload) {
  return {
    content: [
      {
        type: 'text',
        text: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function errorResult(message) {
  return {
    content: [{ type: 'text', text: `ERROR: ${message}` }],
    isError: true,
  };
}

function collectUniquePaths(changes = []) {
  return [...new Set(changes.map((c) => c.path))];
}

function summarizeRisk(change) {
  const action = String(change.action || 'replace');
  if (action === 'overwrite') return 'high';
  if (action === 'append') return 'low';
  return 'medium';
}

function makeControlGaps(inventory) {
  const hints = inventory?.contextHints || {};
  const ciWorkflowFiles = Array.isArray(hints.ciWorkflowFiles) ? hints.ciWorkflowFiles : [];
  const complianceFiles = Array.isArray(hints.complianceFiles) ? hints.complianceFiles : [];
  const lockfiles = Array.isArray(hints.lockfiles) ? hints.lockfiles : [];
  const dockerfiles = Array.isArray(hints.dockerfiles) ? hints.dockerfiles : [];
  const iacFiles = Array.isArray(hints.iacFiles) ? hints.iacFiles : [];

  const gaps = [];
  if (!inventory?.securitySignals?.hasCi) {
    gaps.push(enrichGapWithFrmrTargets({
      id: 'gap-ci-missing',
      severity: 'high',
      controlFamily: 'CM/SI',
      description: 'CI pipeline not detected; continuous validation controls likely weak.',
      recommendation:
        'Add CI workflow with lint/test/build and vulnerability scanning gates.',
      controlIntent: {
        fedramp: ['CM-3', 'CM-6', 'SI-2', 'SI-7'],
        frmr: ['continuous_validation', 'change_control', 'vulnerability_management'],
      },
      contextTargets: {
        ciWorkflowFiles,
        complianceFiles: complianceFiles.slice(0, 10),
      },
      acceptanceCriteria: [
        'CI runs lint/test/build on push and pull_request',
        'Security scanning runs in CI and blocks high/critical findings by policy',
        'Workflow artifacts or run URLs are referenceable for evidence ingest',
      ],
    }));
  }
  if (!inventory?.securitySignals?.hasDependencyLock) {
    gaps.push(enrichGapWithFrmrTargets({
      id: 'gap-lockfile-missing',
      severity: 'high',
      controlFamily: 'RA/SI',
      description: 'Dependency lockfile not detected; reproducibility and vuln management risk.',
      recommendation:
        'Commit lockfiles and enforce deterministic dependency install in CI.',
      controlIntent: {
        fedramp: ['CM-2', 'RA-5', 'SI-2'],
        frmr: ['dependency_integrity', 'vulnerability_management'],
      },
      contextTargets: {
        lockfiles,
        ciWorkflowFiles,
      },
      acceptanceCriteria: [
        'At least one ecosystem lockfile committed and used in CI',
        'Dependency install is deterministic and reproducible',
      ],
    }));
  }
  if (inventory?.securitySignals?.hasSecretsFiles) {
    gaps.push(enrichGapWithFrmrTargets({
      id: 'gap-secrets-files',
      severity: 'critical',
      controlFamily: 'SC/IA',
      description: 'Potential secrets file patterns detected in repository.',
      recommendation:
        'Move secrets to env manager/secret store and add pre-commit secret scanning.',
      controlIntent: {
        fedramp: ['SC-28', 'IA-5', 'CM-6'],
        frmr: ['secret_management', 'credential_hygiene'],
      },
      contextTargets: {
        complianceFiles: complianceFiles.slice(0, 10),
      },
      acceptanceCriteria: [
        'No plaintext secret files tracked in repository',
        'Secret scanning enabled pre-commit and/or CI',
      ],
    }));
  }
  if ((inventory?.iac?.terraformFiles || 0) > 0 && !inventory?.securitySignals?.hasSast) {
    gaps.push(enrichGapWithFrmrTargets({
      id: 'gap-iac-scanning',
      severity: 'medium',
      controlFamily: 'RA/CM',
      description: 'IaC detected without obvious security scan tooling signals.',
      recommendation: 'Add IaC scanner checks (tfsec/checkov/trivy config scan) in CI.',
      controlIntent: {
        fedramp: ['RA-5', 'CM-6', 'CA-7'],
        frmr: ['iac_posture_validation', 'continuous_monitoring'],
      },
      contextTargets: {
        iacFiles: iacFiles.slice(0, 20),
        ciWorkflowFiles,
        dockerfiles: dockerfiles.slice(0, 10),
      },
      acceptanceCriteria: [
        'IaC scan runs on every infrastructure change',
        'Scan output is retained for compliance evidence',
      ],
    }));
  }
  return gaps;
}

function buildRemediationPlan({ gaps = [], inventory = {}, strategy = 'balanced' }) {
  const selectedSkills = selectSkills({ objective: strategy, inventory });
  const ordered = [...gaps].sort((a, b) => {
    const rank = { critical: 4, high: 3, medium: 2, low: 1 };
    return (rank[b.severity] || 0) - (rank[a.severity] || 0);
  });
  return {
    strategy,
    selectedSkills: selectedSkills.map((s) => ({ id: s.id, title: s.title })),
    repoContext: {
      rootPath: inventory?.rootPath || null,
      frameworks: inventory?.frameworks || [],
      languages: inventory?.languages || [],
      contextHints: inventory?.contextHints || {},
    },
    nextMcpCalls: [
      {
        tool: 'compliance_agent_autopilot_v1',
        why: 'Bootstrap or reuse project, then update evidence + auto-scope in one call',
        inputTemplate: {
          createProjectIfMissing: true,
          strategy,
        },
      },
      {
        tool: 'validate_remediation_v1',
        why: 'Run bounded validation after remediation edits',
        inputTemplate: {
          commands: ['npm run build', 'npm run test'],
        },
      },
      {
        tool: 'compliance_agent_autopilot_v1',
        why: 'Re-run after code changes to confirm gaps reduced and evidence refreshed',
        inputTemplate: {
          createProjectIfMissing: false,
          strategy,
        },
      },
    ],
    phases: [
      {
        phase: 'stabilize',
        tasks: ordered
          .filter((g) => g.severity === 'critical' || g.severity === 'high')
          .map((g) => ({
            gapId: g.id,
            action: g.recommendation,
            controlIntent: g.controlIntent || {},
            frmrTargets: g.frmrTargets || [],
            ksiTargets: g.ksiTargets || [],
            contextTargets: g.contextTargets || {},
            closeCriteria: g.closeCriteria || g.acceptanceCriteria || [],
            acceptanceCriteria: g.acceptanceCriteria || [],
          })),
      },
      {
        phase: 'harden',
        tasks: ordered
          .filter((g) => g.severity === 'medium')
          .map((g) => ({
            gapId: g.id,
            action: g.recommendation,
            controlIntent: g.controlIntent || {},
            frmrTargets: g.frmrTargets || [],
            ksiTargets: g.ksiTargets || [],
            contextTargets: g.contextTargets || {},
            closeCriteria: g.closeCriteria || g.acceptanceCriteria || [],
            acceptanceCriteria: g.acceptanceCriteria || [],
          })),
      },
      {
        phase: 'optimize',
        tasks: ordered
          .filter((g) => g.severity === 'low')
          .map((g) => ({
            gapId: g.id,
            action: g.recommendation,
            controlIntent: g.controlIntent || {},
            frmrTargets: g.frmrTargets || [],
            ksiTargets: g.ksiTargets || [],
            contextTargets: g.contextTargets || {},
            closeCriteria: g.closeCriteria || g.acceptanceCriteria || [],
            acceptanceCriteria: g.acceptanceCriteria || [],
          })),
      },
    ],
  };
}

function buildCiWorkflowContent(inventory = {}) {
  const hasNode =
    Array.isArray(inventory.languages) &&
    (inventory.languages.includes('typescript') || inventory.languages.includes('javascript'));
  const hasPython =
    Array.isArray(inventory.languages) && inventory.languages.includes('python');
  const hasDocker = Array.isArray(inventory.frameworks) && inventory.frameworks.includes('docker');

  const jobs = [];
  if (hasNode) {
    jobs.push(`  node_ci:
    runs-on: ubuntu-latest
    if: \${{ hashFiles('**/package.json') != '' }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: |
          if [ -f pnpm-lock.yaml ]; then
            corepack enable
            pnpm install --frozen-lockfile
          elif [ -f yarn.lock ]; then
            yarn install --frozen-lockfile
          elif [ -f package-lock.json ]; then
            npm ci
          else
            npm install
          fi
      - name: Lint
        run: npm run lint --if-present
      - name: Test
        run: npm test --if-present
      - name: Build
        run: npm run build --if-present
      - name: Dependency audit
        run: npm audit --audit-level=high`);
  }

  if (hasPython) {
    jobs.push(`  python_ci:
    runs-on: ubuntu-latest
    if: \${{ hashFiles('**/requirements*.txt', '**/pyproject.toml', '**/poetry.lock') != '' }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Install audit tooling
        run: python -m pip install --upgrade pip pip-audit pytest
      - name: Install dependencies
        run: |
          if [ -f requirements.txt ]; then
            pip install -r requirements.txt
          fi
      - name: Test
        run: python -m pytest
      - name: Dependency audit
        run: pip-audit`);
  }

  if (hasDocker) {
    jobs.push(`  container_scan:
    runs-on: ubuntu-latest
    if: \${{ hashFiles('**/Dockerfile*', '**/docker-compose*.yml', '**/docker-compose*.yaml') != '' }}
    steps:
      - uses: actions/checkout@v4
      - name: Trivy filesystem scan
        uses: aquasecurity/trivy-action@0.24.0
        with:
          scan-type: fs
          ignore-unfixed: true
          severity: HIGH,CRITICAL
          exit-code: '1'`);
  }

  return `name: Open GRC CI
on:
  push:
  pull_request:
  workflow_dispatch:

permissions:
  contents: read
  security-events: write

jobs:
${jobs.join('\n\n')}
`;
}

function buildIacScanWorkflowContent() {
  return `name: Open GRC IaC Scan
on:
  push:
    paths:
      - '**/*.tf'
      - '**/*.yaml'
      - '**/*.yml'
      - '.github/workflows/**'
  pull_request:
    paths:
      - '**/*.tf'
      - '**/*.yaml'
      - '**/*.yml'
      - '.github/workflows/**'
  workflow_dispatch:

permissions:
  contents: read

jobs:
  trivy_config_scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Trivy config scan
        uses: aquasecurity/trivy-action@0.24.0
        with:
          scan-type: config
          exit-code: '1'
          severity: HIGH,CRITICAL
`;
}

function inferValidationCommands(inventory = {}, requested = []) {
  if (Array.isArray(requested) && requested.length > 0) return requested;
  const cmds = [];
  if (
    Array.isArray(inventory.languages) &&
    (inventory.languages.includes('typescript') || inventory.languages.includes('javascript'))
  ) {
    cmds.push('npm run lint', 'npm run test', 'npm run build');
  }
  if (Array.isArray(inventory.languages) && inventory.languages.includes('python')) {
    cmds.push('python -m pytest');
  }
  if (
    Array.isArray(inventory.frameworks) &&
    inventory.frameworks.includes('docker')
  ) {
    cmds.push('trivy fs .');
  }
  return [...new Set(cmds)];
}

function buildClosureChanges({ gaps = [], inventory = {} }) {
  const changes = [];
  for (const gap of gaps) {
    if (gap.id === 'gap-ci-missing') {
      changes.push({
        path: '.github/workflows/open-grc-ci.yml',
        action: 'overwrite',
        content: buildCiWorkflowContent(inventory),
      });
    }
    if (gap.id === 'gap-iac-scanning') {
      changes.push({
        path: '.github/workflows/open-grc-iac-scan.yml',
        action: 'overwrite',
        content: buildIacScanWorkflowContent(),
      });
    }
  }
  return changes;
}

function summarizeClosureVerdicts(beforeGaps = [], afterGaps = []) {
  const afterIds = new Set(afterGaps.map((g) => g.id));
  return beforeGaps.map((gap) => ({
    gapId: gap.id,
    closed: !afterIds.has(gap.id),
    frmrTargets: gap.frmrTargets || [],
    ksiTargets: gap.ksiTargets || [],
    closeCriteria: gap.closeCriteria || [],
  }));
}

async function applySingleChange(change, runId, backups, workspaceRoot) {
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

async function rollbackRun(runId) {
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

function isCommandAllowed(cmd) {
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

async function runValidationCommands(commands = [], workspaceRoot = config.workspaceRoot) {
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

const tools = [
  {
    name: 'capabilities_v1',
    description:
      'START HERE. Help tool that explains OpenGRC MCP workflows, prerequisites, and recommended tool usage patterns.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        objective: {
          type: 'string',
          description:
            'Optional goal context (for example: onboard repo, create project, sync evidence).',
        },
      },
    },
  },
  {
    name: 'repo_inventory_v1',
    description:
      'Discover languages, frameworks, IaC footprint, and security signals for a repository.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        workspacePath: {
          type: 'string',
          description: 'Absolute workspace root path to analyze',
        },
        path: { type: 'string', description: 'Relative or absolute repo path' },
      },
    },
  },
  {
    name: 'control_gap_map_v1',
    description: 'Map repository/security signals to likely control gaps and priorities.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['inventory'],
      properties: {
        inventory: { type: 'object' },
        framework: { type: 'string', default: 'fedramp' },
      },
    },
  },
  {
    name: 'remediation_plan_v1',
    description: 'Generate ordered remediation plan from control gaps and inventory context.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['gaps', 'inventory'],
      properties: {
        gaps: { type: 'array', items: { type: 'object' } },
        inventory: { type: 'object' },
        strategy: { type: 'string', default: 'balanced' },
      },
    },
  },
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
    name: 'sync_grc_evidence_v1',
    description:
      'Push remediation/security evidence summary into OpenGRC integrations endpoint.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['checklistItemId'],
      properties: {
        checklistItemId: { type: 'string' },
        scanner: { type: 'string' },
        critical: { type: 'number' },
        high: { type: 'number' },
        medium: { type: 'number' },
        low: { type: 'number' },
        reportUrl: { type: 'string' },
      },
    },
  },
  {
    name: 'evidence_link_upsert_v1',
    description:
      'Create or upsert single evidence linkage using project-scoped integration endpoint.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId', 'controlId'],
      properties: {
        projectId: { type: 'string' },
        framework: { type: 'string', default: 'frmr' },
        controlId: { type: 'string' },
        checklistItemId: { type: 'string' },
        evidenceType: { type: 'string' },
        externalUri: { type: 'string' },
        sourceRunId: { type: 'string' },
        occurredAt: { type: 'string' },
        sourceConnector: { type: 'string' },
        metadata: { type: 'object' },
        assertion: { type: 'object' },
        idempotencyKey: { type: 'string' },
      },
    },
  },
  {
    name: 'evidence_link_bulk_ingest_v1',
    description:
      'Bulk ingest evidence links with accepted/rejected detail and idempotency support.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId', 'items'],
      properties: {
        projectId: { type: 'string' },
        idempotencyKey: { type: 'string' },
        items: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['controlId'],
            properties: {
              framework: { type: 'string', default: 'frmr' },
              controlId: { type: 'string' },
              checklistItemId: { type: 'string' },
              evidenceType: { type: 'string' },
              externalUri: { type: 'string' },
              sourceRunId: { type: 'string' },
              occurredAt: { type: 'string' },
              sourceConnector: { type: 'string' },
              metadata: { type: 'object' },
              assertion: { type: 'object' },
            },
          },
        },
      },
    },
  },
  {
    name: 'evidence_link_lookup_control_v1',
    description: 'Resolve framework control reference to an internal checklist item.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId', 'controlId'],
      properties: {
        projectId: { type: 'string' },
        framework: { type: 'string', default: 'frmr' },
        controlId: { type: 'string' },
      },
    },
  },
  {
    name: 'evidence_link_map_control_v1',
    description: 'Create or update explicit control-to-checklist mapping link.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId', 'checklistItemId', 'controlId'],
      properties: {
        projectId: { type: 'string' },
        checklistItemId: { type: 'string' },
        framework: { type: 'string', default: 'frmr' },
        controlId: { type: 'string' },
        notes: { type: 'string' },
      },
    },
  },
  {
    name: 'evidence_link_ingest_status_v1',
    description: 'Fetch status/result payload for a prior idempotent ingest request.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId', 'requestId'],
      properties: {
        projectId: { type: 'string' },
        requestId: { type: 'string' },
      },
    },
  },
  {
    name: 'evidence_link_trigger_auto_scope_v1',
    description: 'Trigger auto-scope run via integration endpoint.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId'],
      properties: {
        projectId: { type: 'string' },
        options: { type: 'object' },
      },
    },
  },
  {
    name: 'connectors_registry_v1',
    description:
      'Connectors are automated evidence-collection integrations that pull scanner or repo artifacts into OpenGRC. List built-in connector types (id, version) available for a project.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId'],
      properties: { projectId: { type: 'string' } },
    },
  },
  {
    name: 'connectors_list_v1',
    description:
      'Connectors are automated evidence-collection integrations. List configured instances for a project (secrets redacted).',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId'],
      properties: { projectId: { type: 'string' } },
    },
  },
  {
    name: 'connectors_status_v1',
    description:
      'Connectors are automated evidence-collection integrations. Summarize health, stale evidence flags, and last run errors.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId'],
      properties: { projectId: { type: 'string' } },
    },
  },
  {
    name: 'connectors_run_v1',
    description:
      'Connectors are automated evidence-collection integrations. Trigger a manual collection run for one instance.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId', 'instanceId'],
      properties: {
        projectId: { type: 'string' },
        instanceId: { type: 'string' },
      },
    },
  },
  {
    name: 'connectors_runs_v1',
    description:
      'Connectors are automated evidence-collection integrations. Inspect recent run history for one instance.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId', 'instanceId'],
      properties: {
        projectId: { type: 'string' },
        instanceId: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'connectors_create_v1',
    description:
      'Connectors are automated evidence-collection integrations. Create an instance (e.g. GitHub, synthetic, AWS) with JSON config.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId', 'connectorId', 'label'],
      properties: {
        projectId: { type: 'string' },
        connectorId: { type: 'string' },
        label: { type: 'string' },
        enabled: { type: 'boolean' },
        config: { type: 'object' },
      },
    },
  },
  {
    name: 'evidence_link_project_bootstrap_verify_v1',
    description:
      'Create integration-auth project and run create->resolve/link->evidence->auto-scope verification chain.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        pathType: { type: 'string', enum: ['20x', 'rev5'] },
        impactLevel: { type: 'string', enum: ['low', 'moderate', 'high'] },
        actorLabels: { type: 'string' },
        complianceStartDate: { type: 'string' },
        includeKsi: { type: 'boolean' },
        evidenceType: { type: 'string' },
        externalUri: { type: 'string' },
        sourceRunId: { type: 'string' },
        sourceConnector: { type: 'string' },
        idempotencyKey: { type: 'string' },
        metadata: { type: 'object' },
        assertion: { type: 'object' },
        autoScopeOptions: { type: 'object' },
      },
    },
  },
  {
    name: 'frmr_taxonomy_v1',
    description:
      'Fetch FedRAMP Requirements and Metrics Repository (FRMR) taxonomy: processes, requirements, and Key Security Indicators (KSI). pathType 20x = FedRAMP 20x authorization path; rev5 = FedRAMP Rev 5 baseline. Use before planning or reporting.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        pathType: { type: 'string', enum: ['20x', 'rev5'] },
        layer: { type: 'string', enum: ['both', '20x', 'rev5'] },
        actor: { type: 'string' },
      },
    },
  },
  {
    name: 'catalog_frameworks_v1',
    description:
      'List generic compliance frameworks registered in the catalog (fedramp_frmr, nist_csf_2, …). Complements frmr_taxonomy_v1 with stable framework codes.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: 'opengrc_search_v1',
    description:
      'Unified search across checklist items, evidence, risks, and policies (uses integration API key as Bearer).',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['q'],
      properties: {
        q: { type: 'string', description: 'Search string (min 2 characters)' },
        types: {
          type: 'string',
          description: 'Comma-separated: checklist,evidence,risk,policy',
        },
        projectId: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'opengrc_policies_list_v1',
    description: 'List governance policies visible to the integration user.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        projectId: { type: 'string' },
        status: { type: 'string' },
      },
    },
  },
  {
    name: 'compliance_agent_autopilot_v1',
    description:
      'RECOMMENDED. Compliance autopilot: scan repo inventory, map gaps to controls, build remediation plan, optionally create or use an OpenGRC project, upsert evidence, trigger auto-scope. executionMode analyze=dry analysis; dry_run=validate edits; apply=write files and run linkage. Abbreviations: FRMR=FedRAMP Requirements and Metrics Repository; KSI=Key Security Indicator; API=OpenGRC REST API.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        workspacePath: {
          type: 'string',
          description: 'Absolute workspace root path for repo inventory scan',
        },
        executionMode: {
          type: 'string',
          enum: ['analyze', 'dry_run', 'apply'],
          default: 'analyze',
        },
        strategy: { type: 'string', default: 'balanced' },
        projectId: { type: 'string' },
        controlId: { type: 'string' },
        checklistItemId: { type: 'string' },
        framework: { type: 'string', default: 'frmr' },
        createProjectIfMissing: { type: 'boolean', default: true },
        projectName: { type: 'string' },
        pathType: { type: 'string', enum: ['20x', 'rev5'] },
        impactLevel: { type: 'string', enum: ['low', 'moderate', 'high'] },
        actorLabels: { type: 'string' },
        complianceStartDate: { type: 'string' },
        includeKsi: { type: 'boolean' },
        evidenceType: { type: 'string' },
        externalUri: { type: 'string' },
        sourceRunId: { type: 'string' },
        sourceConnector: { type: 'string' },
        metadata: { type: 'object' },
        assertion: { type: 'object' },
        autoScopeOptions: { type: 'object' },
        validationCommands: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'fedramp_oscal_report_v1',
    description:
      'Package FedRAMP assessor handoff: OSCAL (Open Security Controls Assessment Language) artifacts including SSP (System Security Plan) JSON, POA&M (Plan of Action and Milestones) JSON, and a closure manifest.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId'],
      properties: {
        projectId: { type: 'string' },
        pathType: { type: 'string', enum: ['20x', 'rev5'], default: '20x' },
        closureSummary: { type: 'object' },
        evidenceRequestIds: { type: 'array', items: { type: 'string' } },
        autoScopeRunIds: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'gap_closure_execution_brief_v1',
    description:
      'Generate a strict gap-closure brief: FRMR (FedRAMP Requirements and Metrics Repository) and KSI (Key Security Indicator) targets, proposed file edits, validation commands, and next MCP calls before applying changes.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        workspacePath: {
          type: 'string',
          description: 'Absolute workspace root path for repo inventory scan',
        },
        strategy: { type: 'string', default: 'balanced' },
      },
    },
  },
  {
    name: 'list_skills_v1',
    description: 'List available control/remediation skills from MCP skill registry.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: 'run_skill_agent_v1',
    description:
      'Select and execute skill playbook recommendations for a control objective.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['objective'],
      properties: {
        objective: { type: 'string' },
        inventory: { type: 'object' },
      },
    },
  },
  {
    name: 'get_run_log_v1',
    description: 'Retrieve audit timeline for a remediation run.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['runId'],
      properties: {
        runId: { type: 'string' },
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

function createProtocolServer() {
  const server = new Server(
    {
      name: 'open-grc-mcp',
      version: MCP_PROTOCOL_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request?.params?.name;
    const args = request?.params?.arguments || {};

    try {
      if (name === 'capabilities_v1') {
        const objective = String(args.objective || '').trim();
        const objectiveHint = objective
          ? {
              objective,
              recommendedFirstTool: 'compliance_agent_autopilot_v1',
              note:
                'Use compliance_agent_autopilot_v1 first unless you need fine-grained linkage control.',
            }
          : null;
        return textResult({
          ok: true,
          server: 'open-grc-mcp',
          mcpProtocolVersion: MCP_PROTOCOL_VERSION,
          opengrcApiVersion: process.env.OPENGRC_API_VERSION || '0.2.0',
          version: MCP_PROTOCOL_VERSION,
          startHere: {
            tool: 'compliance_agent_autopilot_v1',
            reason:
              'Single-call orchestration for repo analysis, project bootstrap (if needed), evidence linkage, and auto-scope trigger.',
          },
          prerequisites: {
            mcpEndpoint: `http://${config.httpHost}:${config.httpPort}${config.httpPath}`,
            apiUrl: config.opengrcApiUrl,
            integrationKeyRequiredForLinkage: true,
            envVars: ['OPEN_GRC_API_URL', 'INTEGRATION_API_KEY'],
          },
          workflows: [
            {
              name: 'Autopilot (recommended)',
              tool: 'compliance_agent_autopilot_v1',
              purpose:
                'Discover repo context, infer gaps, build plan, and ensure project/linkage/evidence flow.',
              exampleInput: {
                strategy: 'balanced',
                createProjectIfMissing: true,
                projectName: 'Agent Autopilot Project',
                executionMode: 'apply',
              },
            },
            {
              name: 'Execution brief',
              tool: 'gap_closure_execution_brief_v1',
              purpose:
                'Get deterministic FRMR/KSI targets, proposed file changes, and validation commands before applying edits.',
            },
            {
              name: 'FRMR taxonomy',
              tool: 'frmr_taxonomy_v1',
              purpose:
                'Resolve 20x/rev5 process and requirement structure before planning or reporting.',
            },
            {
              name: 'Catalog frameworks',
              tool: 'catalog_frameworks_v1',
              purpose:
                'List registered framework codes (fedramp_frmr, nist_csf_2, …) for stable requirement references.',
            },
            {
              name: 'FedRAMP report package',
              tool: 'fedramp_oscal_report_v1',
              purpose:
                'Produce OSCAL SSP JSON, OSCAL POA&M JSON, and machine-readable closure manifest for review teams.',
            },
            {
              name: 'Create + verify chain',
              tool: 'evidence_link_project_bootstrap_verify_v1',
              purpose:
                'Create project and verify control resolution, evidence ingest, and auto-scope in one chain.',
              exampleInput: {
                name: 'MCP Verify Chain',
                pathType: '20x',
                impactLevel: 'moderate',
                includeKsi: true,
              },
            },
            {
              name: 'Fine-grained linkage',
              tools: [
                'evidence_link_map_control_v1',
                'evidence_link_lookup_control_v1',
                'evidence_link_upsert_v1',
                'evidence_link_trigger_auto_scope_v1',
              ],
              purpose: 'Step-by-step control mapping and evidence pipeline operations.',
            },
          ],
          quickPromptTemplate:
            'Call capabilities_v1, then frmr_taxonomy_v1, then gap_closure_execution_brief_v1, then compliance_agent_autopilot_v1 with executionMode=apply, then fedramp_oscal_report_v1.',
          ...(objectiveHint ? { objectiveHint } : {}),
        });
      }

      if (name === 'repo_inventory_v1') {
        const workspaceRoot = resolveWorkspaceRoot(args);
        const root = resolveTargetPath(workspaceRoot, args.path);
        const inventory = await scanRepoInventory(root);
        return textResult(inventory);
      }

      if (name === 'control_gap_map_v1') {
        const gaps = makeControlGaps(args.inventory || {});
        return textResult({
          framework: args.framework || 'fedramp',
          gapCount: gaps.length,
          gaps,
        });
      }

      if (name === 'remediation_plan_v1') {
        const plan = buildRemediationPlan({
          gaps: args.gaps || [],
          inventory: args.inventory || {},
          strategy: args.strategy || 'balanced',
        });
        return textResult(plan);
      }

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

      if (name === 'sync_grc_evidence_v1') {
        const result = await syncGrcEvidence(args);
        return textResult(result);
      }

      if (name === 'evidence_link_upsert_v1') {
        const result = await evidenceLinkUpsertV1(args);
        return textResult(result);
      }

      if (name === 'evidence_link_bulk_ingest_v1') {
        const result = await evidenceLinkBulkIngestV1(args);
        return textResult(result);
      }

      if (name === 'evidence_link_lookup_control_v1') {
        const result = await evidenceLinkLookupControlV1(args);
        return textResult(result);
      }

      if (name === 'evidence_link_map_control_v1') {
        const result = await evidenceLinkMapControlV1(args);
        return textResult(result);
      }

      if (name === 'evidence_link_ingest_status_v1') {
        const result = await evidenceLinkIngestStatusV1(args);
        return textResult(result);
      }

      if (name === 'evidence_link_trigger_auto_scope_v1') {
        const result = await evidenceLinkTriggerAutoScopeV1(args);
        return textResult(result);
      }

      if (name === 'connectors_registry_v1') {
        const result = await connectorsRegistryV1(args);
        return textResult(result);
      }
      if (name === 'connectors_list_v1') {
        const result = await connectorsListV1(args);
        return textResult(result);
      }
      if (name === 'connectors_status_v1') {
        const result = await connectorsStatusV1(args);
        return textResult(result);
      }
      if (name === 'connectors_run_v1') {
        const result = await connectorsRunV1(args);
        return textResult(result);
      }
      if (name === 'connectors_runs_v1') {
        const result = await connectorsRunsV1(args);
        return textResult(result);
      }
      if (name === 'connectors_create_v1') {
        const result = await connectorsCreateV1(args);
        return textResult(result);
      }

      if (name === 'evidence_link_project_bootstrap_verify_v1') {
        const result = await evidenceLinkProjectBootstrapVerifyV1(args);
        return textResult(result);
      }

      if (name === 'frmr_taxonomy_v1') {
        const result = await getFrmrTaxonomy(args);
        return textResult(result);
      }

      if (name === 'opengrc_search_v1') {
        const result = await opengrcSearchV1(args);
        return textResult(result);
      }

      if (name === 'opengrc_policies_list_v1') {
        const result = await opengrcPoliciesListV1(args);
        return textResult(result);
      }

      if (name === 'catalog_frameworks_v1') {
        const raw = await getCatalogFrameworks();
        const frameworks = Array.isArray(raw) ? raw : raw?.frameworks || [];
        return textResult({
          frameworks,
          aliases: { frmr: 'fedramp_frmr', fedramp: 'fedramp_frmr' },
        });
      }

      if (name === 'compliance_agent_autopilot_v1') {
        const workspaceRoot = resolveWorkspaceRoot(args);
        const root = resolveTargetPath(workspaceRoot, args.path);
        const executionMode = args.executionMode || 'analyze';
        const inventory = await scanRepoInventory(root);
        const gaps = makeControlGaps(inventory);
        const remediationPlan = buildRemediationPlan({
          gaps,
          inventory,
          strategy: args.strategy || 'balanced',
        });
        const proposedChanges = buildClosureChanges({
          gaps,
          inventory,
        });
        const validationCommands = inferValidationCommands(
          inventory,
          args.validationCommands,
        );

        const createProjectIfMissing = args.createProjectIfMissing !== false;
        const linkage = {
          ok: false,
          mode: null,
          projectId: args.projectId || null,
          controlResolution: null,
          controlMapping: null,
          evidenceIngest: null,
          autoScope: null,
          diagnostics: [],
        };

        const execution = {
          mode: executionMode,
          proposedChanges,
          validationCommands,
          runId: null,
          changedFiles: [],
          validation: [],
          before: {
            gapCount: gaps.length,
            gaps,
          },
          after: null,
          closureVerdicts: [],
        };

        if (executionMode === 'dry_run') {
          for (const change of proposedChanges) {
            await assertSafeFileForWrite(resolveTargetPath(root, change.path));
          }
        }

        if (executionMode === 'apply' && proposedChanges.length > 0) {
          const runId = args.runId || createRunId();
          const backups = runSessions.get(runId)?.backups || new Map();
          runSessions.set(runId, { backups, workspaceRoot: root, createdAt: new Date().toISOString() });
          await appendRunEvent(runId, {
            type: 'autopilot_apply_started',
            workspaceRoot: root,
            steps: proposedChanges.length,
          });
          for (const change of proposedChanges) {
            await applySingleChange(change, runId, backups, root);
          }
          await appendRunEvent(runId, {
            type: 'autopilot_apply_completed',
            changedFiles: collectUniquePaths(proposedChanges),
          });
          execution.runId = runId;
          execution.changedFiles = collectUniquePaths(proposedChanges);
          execution.validation = await runValidationCommands(validationCommands, root);
          const inventoryAfter = await scanRepoInventory(root);
          const gapsAfter = makeControlGaps(inventoryAfter);
          execution.after = {
            gapCount: gapsAfter.length,
            gaps: gapsAfter,
            inventorySummary: {
              fileCount: inventoryAfter?.fileCount || 0,
              securitySignals: inventoryAfter?.securitySignals || {},
            },
          };
          execution.closureVerdicts = summarizeClosureVerdicts(gaps, gapsAfter);
        }

        if (!args.projectId && createProjectIfMissing) {
          if (executionMode === 'apply') {
            const created = await createProjectV1({
              name: args.projectName || `Compliance Autopilot ${new Date().toISOString()}`,
              pathType: args.pathType,
              impactLevel: args.impactLevel,
              actorLabels: args.actorLabels,
              complianceStartDate: args.complianceStartDate,
              includeKsi: args.includeKsi,
            });
            const createdHint = created?.verificationHint || null;
            linkage.mode = 'created_project_full_loop';
            linkage.projectId = created?.project?.id || null;
            const primaryGap = gaps[0] || null;
            const primaryControlId = primaryGap?.frmrTargets?.[0]
              ? `frr:${primaryGap.frmrTargets[0].processId}:${primaryGap.frmrTargets[0].reqKey}`
              : primaryGap?.ksiTargets?.[0]
                ? `ksi:${primaryGap.ksiTargets[0]}`
                : createdHint?.controlId || null;
            if (linkage.projectId && primaryControlId) {
              try {
                linkage.controlResolution = await evidenceLinkLookupControlV1({
                  projectId: linkage.projectId,
                  framework: 'frmr',
                  controlId: primaryControlId,
                });
              } catch (error) {
                linkage.diagnostics.push({
                  step: 'resolve_control',
                  error: error instanceof Error ? error.message : String(error),
                  fallback: 'verification_hint',
                });
              }
            }
            if (!linkage.controlResolution) {
              linkage.diagnostics.push({
                step: 'resolve_control',
                error:
                  'Unable to resolve a FRMR target for the created project; evidence ingest skipped for full-loop path.',
                hint: createdHint,
              });
            } else {
              linkage.evidenceIngest = await evidenceLinkUpsertV1({
                projectId: linkage.projectId,
                framework: 'frmr',
                controlId: primaryControlId,
                checklistItemId: linkage.controlResolution?.checklistItemId,
                evidenceType: args.evidenceType || 'compliance_agent_autopilot_v1',
                externalUri: args.externalUri || null,
                sourceRunId:
                  args.sourceRunId || execution.runId || `autopilot-${Date.now().toString(36)}`,
                sourceConnector: args.sourceConnector || 'open_grc_mcp_autopilot',
                metadata: {
                  autopilot: true,
                  executionMode,
                  gapCount: gaps.length,
                  closureVerdicts: execution.closureVerdicts,
                  strategy: args.strategy || 'balanced',
                  changedFiles: execution.changedFiles,
                  ...(args.metadata || {}),
                },
                assertion:
                  args.assertion || {
                    status: 'pass',
                    message: 'Autopilot compliance closure evidence',
                    measuredAt: new Date().toISOString(),
                  },
              });
              linkage.autoScope = await evidenceLinkTriggerAutoScopeV1({
                projectId: linkage.projectId,
                options: args.autoScopeOptions || {},
              });
              linkage.ok = Boolean(
                linkage.projectId && linkage.controlResolution && linkage.evidenceIngest && linkage.autoScope,
              );
            }
          } else {
            const bootstrap = await evidenceLinkProjectBootstrapVerifyV1({
              name: args.projectName || `Compliance Autopilot ${new Date().toISOString()}`,
              pathType: args.pathType,
              impactLevel: args.impactLevel,
              actorLabels: args.actorLabels,
              complianceStartDate: args.complianceStartDate,
              includeKsi: args.includeKsi,
              evidenceType: args.evidenceType || 'compliance_agent_autopilot_v1',
              externalUri: args.externalUri || null,
              sourceRunId: args.sourceRunId,
              sourceConnector: args.sourceConnector || 'open_grc_mcp_autopilot',
              metadata: {
                autopilot: true,
                executionMode,
                gapCount: gaps.length,
                strategy: args.strategy || 'balanced',
                ...(args.metadata || {}),
              },
              assertion: args.assertion,
              autoScopeOptions: args.autoScopeOptions || {},
            });
            linkage.ok = Boolean(bootstrap?.ok);
            linkage.mode = 'created_project_chain';
            linkage.projectId = bootstrap?.projectId || null;
            linkage.controlResolution = bootstrap?.controlResolution || null;
            linkage.controlMapping = bootstrap?.controlMapping || null;
            linkage.evidenceIngest = bootstrap?.evidenceIngest || null;
            linkage.autoScope = bootstrap?.autoScope || null;
            linkage.diagnostics = Array.isArray(bootstrap?.diagnostics)
              ? bootstrap.diagnostics
              : [];
          }
        } else if (args.projectId) {
          const framework = args.framework || 'frmr';
          const primaryGap = gaps[0] || null;
          const controlId = args.controlId ||
            (primaryGap?.frmrTargets?.[0]
              ? `frr:${primaryGap.frmrTargets[0].processId}:${primaryGap.frmrTargets[0].reqKey}`
              : primaryGap?.ksiTargets?.[0]
                ? `ksi:${primaryGap.ksiTargets[0]}`
                : undefined);
          if (!controlId) {
            linkage.mode = 'existing_project_missing_control';
            linkage.diagnostics.push({
              step: 'input_validation',
              error:
                'controlId is required when using an existing projectId; omit projectId to auto-create and bootstrap.',
            });
          } else {
            linkage.mode = 'existing_project_chain';
            linkage.projectId = args.projectId;
            if (args.checklistItemId) {
              try {
                linkage.controlMapping = await evidenceLinkMapControlV1({
                  projectId: args.projectId,
                  checklistItemId: args.checklistItemId,
                  framework,
                  controlId,
                  notes: 'auto-mapped by compliance_agent_autopilot_v1',
                });
              } catch (error) {
                linkage.diagnostics.push({
                  step: 'map_control',
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }
            linkage.controlResolution = await evidenceLinkLookupControlV1({
              projectId: args.projectId,
              framework,
              controlId,
            });
            linkage.evidenceIngest = await evidenceLinkUpsertV1({
              projectId: args.projectId,
              framework,
              controlId,
              checklistItemId:
                linkage.controlResolution?.checklistItemId || args.checklistItemId,
              evidenceType: args.evidenceType || 'compliance_agent_autopilot_v1',
              externalUri: args.externalUri || null,
              sourceRunId: args.sourceRunId || `autopilot-${Date.now().toString(36)}`,
              sourceConnector: args.sourceConnector || 'open_grc_mcp_autopilot',
              metadata: {
                autopilot: true,
                gapCount: gaps.length,
                strategy: args.strategy || 'balanced',
                ...(args.metadata || {}),
              },
              assertion:
                args.assertion || {
                  status: 'pass',
                  message: 'Autopilot compliance linkage evidence',
                  measuredAt: new Date().toISOString(),
                },
            });
            linkage.autoScope = await evidenceLinkTriggerAutoScopeV1({
              projectId: args.projectId,
              options: args.autoScopeOptions || {},
            });
            linkage.ok = Boolean(
              linkage.controlResolution && linkage.evidenceIngest && linkage.autoScope,
            );
          }
        } else {
          linkage.mode = 'analysis_only';
          linkage.diagnostics.push({
            step: 'linkage',
            warning:
              'No projectId supplied and createProjectIfMissing=false, returning analysis/plan only.',
          });
        }

        return textResult({
          ok: Boolean(linkage.ok),
          workspaceRoot: root,
          execution,
          inventorySummary: {
            fileCount: inventory?.fileCount || 0,
            languageHints: inventory?.languages || [],
            securitySignals: inventory?.securitySignals || {},
          },
          gapCount: gaps.length,
          gaps,
          remediationPlan,
          linkage,
          recommendedNextSteps: [
            executionMode === 'analyze'
              ? 'Re-run compliance_agent_autopilot_v1 with executionMode=apply to attempt safe closure'
              : 'Review execution.after and closureVerdicts to confirm gap reduction',
            'Apply prioritized remediation tasks from remediationPlan.phases',
            'Use gap_closure_execution_brief_v1 for a strict action plan before editing',
          ],
        });
      }

      if (name === 'fedramp_oscal_report_v1') {
        const result = await fedrampOscalReportV1(args);
        return textResult(result);
      }

      if (name === 'gap_closure_execution_brief_v1') {
        const workspaceRoot = resolveWorkspaceRoot(args);
        const root = resolveTargetPath(workspaceRoot, args.path);
        const inventory = await scanRepoInventory(root);
        const gaps = makeControlGaps(inventory);
        const remediationPlan = buildRemediationPlan({
          gaps,
          inventory,
          strategy: args.strategy || 'balanced',
        });
        const proposedChanges = buildClosureChanges({ gaps, inventory });
        return textResult({
          ok: true,
          workspaceRoot: root,
          gapCount: gaps.length,
          gaps,
          repoContext: remediationPlan.repoContext,
          proposedChanges,
          validationCommands: inferValidationCommands(inventory),
          nextMcpCalls: remediationPlan.nextMcpCalls,
          closureBrief: gaps.map((gap) => ({
            gapId: gap.id,
            frmrTargets: gap.frmrTargets || [],
            ksiTargets: gap.ksiTargets || [],
            closeCriteria: gap.closeCriteria || [],
            contextTargets: gap.contextTargets || {},
          })),
        });
      }

      if (name === 'list_skills_v1') {
        return textResult({
          count: skillCatalog.length,
          skills: skillCatalog,
        });
      }

      if (name === 'run_skill_agent_v1') {
        const objective = String(args.objective || '');
        const inventory = args.inventory || {};
        const selected = selectSkills({ objective, inventory });
        const runbook = selected.map((s) => ({
          id: s.id,
          title: s.title,
          controls: s.controls,
          actions: s.playbook,
        }));
        return textResult({
          objective,
          selectedSkills: selected.map((s) => s.id),
          runbook,
        });
      }

      if (name === 'get_run_log_v1') {
        const logs = await readRunLog(args.runId);
        return textResult({ runId: args.runId, events: logs });
      }

      if (name === 'rollback_run_v1') {
        const result = await rollbackRun(args.runId);
        return textResult(result);
      }

      return errorResult(`Unknown tool: ${name}`);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  });

  return server;
}

function sendJsonRpcError(res, statusCode, message, id = null) {
  if (res.headersSent) return;
  res.status(statusCode).json({
    jsonrpc: '2.0',
    error: { code: -32000, message },
    id,
  });
}

const app = createMcpExpressApp({
  host: config.httpHost,
  ...(config.allowedHosts.length ? { allowedHosts: config.allowedHosts } : {}),
});
app.disable('x-powered-by');

app.post(config.httpPath, async (req, res) => {
  const body = req.body;
  const existingSessionId = req.headers['mcp-session-id'];
  const sessionId =
    typeof existingSessionId === 'string'
      ? existingSessionId
      : Array.isArray(existingSessionId)
        ? existingSessionId[0]
        : undefined;

  let session = sessionId ? transportBySessionId.get(sessionId) : undefined;

  if (!session) {
    if (!isInitializeRequest(body)) {
      return sendJsonRpcError(
        res,
        400,
        'No active MCP session. Send initialize request first.',
        body?.id ?? null,
      );
    }
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });
    const server = createProtocolServer();
    await server.connect(transport);
    transport.onclose = async () => {
      if (transport.sessionId) {
        transportBySessionId.delete(transport.sessionId);
      }
      await server.close();
    };
    session = { server, transport };
  }

  await session.transport.handleRequest(req, res, body);

  if (session.transport.sessionId) {
    transportBySessionId.set(session.transport.sessionId, session);
  }
});

app.get(config.httpPath, async (req, res) => {
  const existingSessionId = req.headers['mcp-session-id'];
  const sessionId =
    typeof existingSessionId === 'string'
      ? existingSessionId
      : Array.isArray(existingSessionId)
        ? existingSessionId[0]
        : undefined;
  const session = sessionId ? transportBySessionId.get(sessionId) : undefined;
  if (!session) {
    return sendJsonRpcError(res, 400, 'Missing or invalid MCP session id.');
  }
  await session.transport.handleRequest(req, res);
});

app.delete(config.httpPath, async (req, res) => {
  const existingSessionId = req.headers['mcp-session-id'];
  const sessionId =
    typeof existingSessionId === 'string'
      ? existingSessionId
      : Array.isArray(existingSessionId)
        ? existingSessionId[0]
        : undefined;
  const session = sessionId ? transportBySessionId.get(sessionId) : undefined;
  if (!session) {
    return sendJsonRpcError(res, 400, 'Missing or invalid MCP session id.');
  }
  await session.transport.handleRequest(req, res);
});

const server = app.listen(config.httpPort, config.httpHost, () => {
  console.log(
    `open-grc-mcp listening on http://${config.httpHost}:${config.httpPort}${config.httpPath}`,
  );
});

async function shutdown() {
  for (const [sessionId, session] of transportBySessionId.entries()) {
    try {
      await session.transport.close();
      await session.server.close();
    } catch {
      // ignore teardown issues on shutdown
    } finally {
      transportBySessionId.delete(sessionId);
    }
  }
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
