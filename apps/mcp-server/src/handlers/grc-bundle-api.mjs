import { textResult } from '../helpers.mjs';
import {
  integrationAuditsCreateV1,
  integrationIncidentsCreateV1,
  integrationVendorsListV1,
} from '../utils/opengrc.mjs';

export const tools = [
  {
    name: 'audits_create_v1',
    description: 'Create a planned GRC audit (internal, external, or 3PAO).',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      required: ['projectId', 'type'],
      properties: {
        projectId: { type: 'string' },
        type: { type: 'string', enum: ['internal', 'external', '3pao'] },
        scope: { type: 'string' },
        plannedStart: { type: 'string' },
        plannedEnd: { type: 'string' },
      },
    },
  },
  {
    name: 'incidents_create_v1',
    description: 'Create a security incident record for a project.',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      required: ['projectId', 'title', 'severity'],
      properties: {
        projectId: { type: 'string' },
        title: { type: 'string' },
        severity: { type: 'string', enum: ['P1', 'P2', 'P3', 'P4'] },
        status: { type: 'string' },
        description: { type: 'string' },
      },
    },
  },
  {
    name: 'vendors_list_v1',
    description: 'List third-party vendors registered for a project.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId'],
      properties: {
        projectId: { type: 'string' },
      },
    },
  },
];

export async function handle(name, args) {
  if (name === 'audits_create_v1') {
    const { projectId, ...body } = args || {};
    const result = await integrationAuditsCreateV1(String(projectId), body);
    return textResult(result);
  }
  if (name === 'incidents_create_v1') {
    const { projectId, ...body } = args || {};
    const result = await integrationIncidentsCreateV1(String(projectId), body);
    return textResult(result);
  }
  if (name === 'vendors_list_v1') {
    const result = await integrationVendorsListV1(String(args.projectId));
    return textResult(result);
  }
  return null;
}
