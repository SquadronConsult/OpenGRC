import { config, MCP_PROTOCOL_VERSION } from '../config.mjs';
import { textResult } from '../helpers.mjs';

export const tools = [
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
];

export async function handle(name, args) {
  if (name !== 'capabilities_v1') return null;

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
    categories: [
      'orchestration',
      'repo_and_gaps',
      'evidence_and_connectors',
      'dashboard_and_reporting',
      'risks_and_policies',
      'pipeline_and_checklist',
      'auto_scope_and_catalog',
      'findings_audits_incidents_vendors',
      'skills_and_audit',
    ],
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
        name: 'Dashboard & executive',
        tools: [
          'dashboard_stats_v1',
          'dashboard_conmon_v1',
          'executive_briefing_v1',
        ],
        purpose: 'KPIs, continuous monitoring, and leadership summary via integration API.',
      },
      {
        name: 'Risks',
        tools: [
          'risks_list_v1',
          'risks_create_v1',
          'risks_heatmap_v1',
          'risks_update_v1',
        ],
        purpose: 'Risk register operations aligned with OpenGRC project risks API.',
      },
      {
        name: 'Policies',
        tools: [
          'policies_create_v1',
          'policies_update_v1',
          'policies_publish_v1',
          'policies_generate_v1',
        ],
        purpose: 'Policy lifecycle and template generation.',
      },
      {
        name: 'Pipeline & checklist',
        tools: ['pipeline_check_v1', 'checklist_patch_item_v1', 'checklist_bulk_update_v1'],
        purpose: 'CI readiness gate and bulk checklist updates.',
      },
      {
        name: 'Auto-scope & cross-map',
        tools: [
          'auto_scope_recommendations_v1',
          'auto_scope_approve_v1',
          'catalog_cross_map_v1',
        ],
        purpose: 'Scope recommendations and framework crosswalk mappings.',
      },
      {
        name: 'Findings & GRC entities',
        tools: [
          'findings_create_v1',
          'findings_list_v1',
          'audits_create_v1',
          'incidents_create_v1',
          'vendors_list_v1',
        ],
        purpose: 'Checklist findings, audits, incidents, and vendor inventory.',
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
