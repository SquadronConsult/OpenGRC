import { assertSafeFileForWrite } from '../utils/guardrails.mjs';
import { scanRepoInventory } from '../utils/repo.mjs';
import { createRunId, appendRunEvent } from '../utils/audit.mjs';
import {
  resolveWorkspaceRoot,
  resolveTargetPath,
  textResult,
  collectUniquePaths,
  runSessions,
  applySingleChange,
  runValidationCommands,
} from '../helpers.mjs';
import {
  makeControlGaps,
  buildRemediationPlan,
  buildClosureChanges,
  inferValidationCommands,
  summarizeClosureVerdicts,
} from './gap-analysis.mjs';
import {
  createProjectV1,
  evidenceLinkUpsertV1,
  evidenceLinkLookupControlV1,
  evidenceLinkMapControlV1,
  evidenceLinkTriggerAutoScopeV1,
  evidenceLinkProjectBootstrapVerifyV1,
} from '../utils/opengrc.mjs';

export const tools = [
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
];

export async function handle(name, args) {
  if (name !== 'compliance_agent_autopilot_v1') return null;

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
  const validationCommands = inferValidationCommands(inventory, args.validationCommands);

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
      linkage.diagnostics = Array.isArray(bootstrap?.diagnostics) ? bootstrap.diagnostics : [];
    }
  } else if (args.projectId) {
    const framework = args.framework || 'frmr';
    const primaryGap = gaps[0] || null;
    const controlId =
      args.controlId ||
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
        checklistItemId: linkage.controlResolution?.checklistItemId || args.checklistItemId,
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
