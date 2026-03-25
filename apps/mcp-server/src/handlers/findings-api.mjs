import { textResult } from '../helpers.mjs';
import {
  integrationFindingsCreateV1,
  integrationFindingsListV1,
} from '../utils/opengrc.mjs';

export const tools = [
  {
    name: 'findings_create_v1',
    description: 'Create a finding linked to a checklist item.',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      required: ['checklistItemId', 'title'],
      properties: {
        checklistItemId: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        severity: { type: 'string' },
      },
    },
  },
  {
    name: 'findings_list_v1',
    description: 'List findings for a checklist item (paginated).',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      required: ['checklistItemId'],
      properties: {
        checklistItemId: { type: 'string' },
        page: { type: 'number' },
        limit: { type: 'number' },
        sort: { type: 'string' },
      },
    },
  },
];

export async function handle(name, args) {
  if (name === 'findings_create_v1') {
    const result = await integrationFindingsCreateV1(args || {});
    return textResult(result);
  }
  if (name === 'findings_list_v1') {
    const { checklistItemId, ...query } = args || {};
    const result = await integrationFindingsListV1(
      String(checklistItemId),
      query,
    );
    return textResult(result);
  }
  return null;
}
