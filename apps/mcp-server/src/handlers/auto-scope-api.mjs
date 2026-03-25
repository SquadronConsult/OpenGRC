import { textResult } from '../helpers.mjs';
import {
  integrationAutoScopeRecommendationsV1,
  integrationAutoScopeApproveV1,
} from '../utils/opengrc.mjs';

export const tools = [
  {
    name: 'auto_scope_recommendations_v1',
    description:
      'List auto-scope recommendations for a project (paginated; filters: status, decision, runId, minConfidence).',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      required: ['projectId'],
      properties: {
        projectId: { type: 'string' },
        page: { type: 'number' },
        limit: { type: 'number' },
        sort: { type: 'string' },
        status: { type: 'string' },
        decision: { type: 'string' },
        runId: { type: 'string' },
        minConfidence: { type: 'number' },
      },
    },
  },
  {
    name: 'auto_scope_approve_v1',
    description: 'Approve a single auto-scope recommendation.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId', 'recommendationId'],
      properties: {
        projectId: { type: 'string' },
        recommendationId: { type: 'string' },
        notes: { type: 'string' },
      },
    },
  },
];

export async function handle(name, args) {
  if (name === 'auto_scope_recommendations_v1') {
    const { projectId, ...query } = args || {};
    const result = await integrationAutoScopeRecommendationsV1(
      String(projectId),
      query,
    );
    return textResult(result);
  }
  if (name === 'auto_scope_approve_v1') {
    const result = await integrationAutoScopeApproveV1(
      String(args.projectId),
      String(args.recommendationId),
      { notes: args.notes },
    );
    return textResult(result);
  }
  return null;
}
