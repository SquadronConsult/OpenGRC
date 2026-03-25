import { textResult } from '../helpers.mjs';
import {
  integrationChecklistBulkUpdateV1,
  integrationChecklistPatchItemV1,
} from '../utils/opengrc.mjs';

export const tools = [
  {
    name: 'checklist_bulk_update_v1',
    description: 'Bulk update checklist items (status, owner, due date).',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      required: ['ids'],
      properties: {
        ids: { type: 'array', items: { type: 'string' } },
        status: { type: 'string' },
        ownerUserId: { type: ['string', 'null'] },
        dueDate: { type: ['string', 'null'] },
      },
    },
  },
  {
    name: 'checklist_patch_item_v1',
    description: 'Patch a single checklist item (status, owner, due date, review state).',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      required: ['checklistItemId'],
      properties: {
        checklistItemId: { type: 'string' },
        status: { type: 'string' },
        ownerUserId: { type: ['string', 'null'] },
        dueDate: { type: ['string', 'null'] },
        reviewState: { type: 'string' },
      },
    },
  },
];

export async function handle(name, args) {
  if (name === 'checklist_bulk_update_v1') {
    const result = await integrationChecklistBulkUpdateV1(args || {});
    return textResult(result);
  }
  if (name === 'checklist_patch_item_v1') {
    const { checklistItemId, ...body } = args || {};
    const result = await integrationChecklistPatchItemV1(
      String(checklistItemId),
      body,
    );
    return textResult(result);
  }
  return null;
}
