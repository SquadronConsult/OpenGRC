import { textResult } from '../helpers.mjs';
import { opengrcSearchV1, opengrcPoliciesListV1 } from '../utils/opengrc.mjs';

export const tools = [
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
];

export async function handle(name, args) {
  if (name === 'opengrc_search_v1') {
    const result = await opengrcSearchV1(args);
    return textResult(result);
  }
  if (name === 'opengrc_policies_list_v1') {
    const result = await opengrcPoliciesListV1(args);
    return textResult(result);
  }
  return null;
}
