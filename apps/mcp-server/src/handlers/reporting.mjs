import { textResult } from '../helpers.mjs';
import {
  fedrampOscalReportV1,
  integrationDashboardStatsV1,
  integrationProjectStatsV1,
  integrationProjectConmonV1,
  integrationExecutiveBriefingV1,
} from '../utils/opengrc.mjs';

export const tools = [
  {
    name: 'dashboard_stats_v1',
    description:
      'OpenGRC dashboard KPIs: global stats when projectId omitted, or project-scoped control counts and readiness.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        projectId: {
          type: 'string',
          description: 'Optional; omit for tenant-wide stats.',
        },
      },
    },
  },
  {
    name: 'dashboard_conmon_v1',
    description:
      'Continuous monitoring summary for a project (evidence freshness, deadlines context).',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId'],
      properties: {
        projectId: { type: 'string' },
      },
    },
  },
  {
    name: 'executive_briefing_v1',
    description:
      'Executive-ready snapshot: readiness stats plus risk heatmap for a project.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId'],
      properties: {
        projectId: { type: 'string' },
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
];

export async function handle(name, args) {
  if (name === 'dashboard_stats_v1') {
    const projectId = args?.projectId ? String(args.projectId) : '';
    const result = projectId
      ? await integrationProjectStatsV1(projectId)
      : await integrationDashboardStatsV1();
    return textResult(result);
  }
  if (name === 'dashboard_conmon_v1') {
    const result = await integrationProjectConmonV1(String(args.projectId));
    return textResult(result);
  }
  if (name === 'executive_briefing_v1') {
    const result = await integrationExecutiveBriefingV1(String(args.projectId));
    return textResult(result);
  }
  if (name === 'fedramp_oscal_report_v1') {
    const result = await fedrampOscalReportV1(args);
    return textResult(result);
  }
  return null;
}
