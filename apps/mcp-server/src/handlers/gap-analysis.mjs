import { selectSkills } from '../skills/catalog.mjs';
import {
  resolveWorkspaceRoot,
  resolveTargetPath,
  textResult,
} from '../helpers.mjs';
import { scanRepoInventory } from '../utils/repo.mjs';
import { runAllDetectors } from '../utils/gap-detectors/index.mjs';

export function makeControlGaps(inventory) {
  return runAllDetectors(inventory);
}

export function buildRemediationPlan({ gaps = [], inventory = {}, strategy = 'balanced' }) {
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

export function buildCiWorkflowContent(inventory = {}) {
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

export function buildIacScanWorkflowContent() {
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

export function inferValidationCommands(inventory = {}, requested = []) {
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
  if (Array.isArray(inventory.frameworks) && inventory.frameworks.includes('docker')) {
    cmds.push('trivy fs .');
  }
  return [...new Set(cmds)];
}

export function buildClosureChanges({ gaps = [], inventory = {} }) {
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

export function summarizeClosureVerdicts(beforeGaps = [], afterGaps = []) {
  const afterIds = new Set(afterGaps.map((g) => g.id));
  return beforeGaps.map((gap) => ({
    gapId: gap.id,
    closed: !afterIds.has(gap.id),
    frmrTargets: gap.frmrTargets || [],
    ksiTargets: gap.ksiTargets || [],
    closeCriteria: gap.closeCriteria || [],
  }));
}

export const tools = [
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
];

export async function handle(name, args) {
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

  return null;
}
