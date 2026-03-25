import { textResult } from '../helpers.mjs';
import {
  integrationRisksListV1,
  integrationRisksCreateV1,
  integrationRisksHeatmapV1,
  integrationRisksUpdateV1,
} from '../utils/opengrc.mjs';

export const tools = [
  {
    name: 'risks_list_v1',
    description:
      'List project risks (paginated) via OpenGRC integration API. Supports page, limit, sort.',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      required: ['projectId'],
      properties: {
        projectId: { type: 'string' },
        page: { type: 'number' },
        limit: { type: 'number' },
        sort: { type: 'string' },
      },
    },
  },
  {
    name: 'risks_create_v1',
    description: 'Create a risk register entry for a project.',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      required: ['projectId', 'title', 'likelihood', 'impact'],
      properties: {
        projectId: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        category: { type: 'string' },
        likelihood: { type: 'number' },
        impact: { type: 'number' },
        residualLikelihood: { type: ['number', 'null'] },
        residualImpact: { type: ['number', 'null'] },
        residualOverrideReason: { type: ['string', 'null'] },
        status: { type: 'string' },
        ownerUserId: { type: ['string', 'null'] },
        appetiteDecision: { type: ['string', 'null'] },
        acceptanceExpiresAt: { type: 'string' },
      },
    },
  },
  {
    name: 'risks_heatmap_v1',
    description: '5×5 likelihood × impact heatmap cell counts for project risks.',
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
    name: 'risks_update_v1',
    description: 'Patch a single risk by id.',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      required: ['projectId', 'riskId'],
      properties: {
        projectId: { type: 'string' },
        riskId: { type: 'string' },
        title: { type: 'string' },
        description: { type: ['string', 'null'] },
        category: { type: ['string', 'null'] },
        likelihood: { type: 'number' },
        impact: { type: 'number' },
        status: { type: 'string' },
        ownerUserId: { type: ['string', 'null'] },
      },
    },
  },
];

export async function handle(name, args) {
  const pid = args?.projectId ? String(args.projectId) : '';
  if (name === 'risks_list_v1') {
    const { projectId, ...query } = args || {};
    const result = await integrationRisksListV1(String(projectId), query);
    return textResult(result);
  }
  if (name === 'risks_create_v1') {
    const { projectId, ...body } = args || {};
    const result = await integrationRisksCreateV1(String(projectId), body);
    return textResult(result);
  }
  if (name === 'risks_heatmap_v1') {
    const result = await integrationRisksHeatmapV1(pid);
    return textResult(result);
  }
  if (name === 'risks_update_v1') {
    const { projectId, riskId, ...body } = args || {};
    const result = await integrationRisksUpdateV1(
      String(projectId),
      String(riskId),
      body,
    );
    return textResult(result);
  }
  return null;
}
