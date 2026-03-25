import { textResult } from '../helpers.mjs';
import { evidenceLinkProjectBootstrapVerifyV1 } from '../utils/opengrc.mjs';

export const tools = [
  {
    name: 'evidence_link_project_bootstrap_verify_v1',
    description:
      'Create integration-auth project and run create->resolve/link->evidence->auto-scope verification chain.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        pathType: { type: 'string', enum: ['20x', 'rev5'] },
        impactLevel: { type: 'string', enum: ['low', 'moderate', 'high'] },
        actorLabels: { type: 'string' },
        complianceStartDate: { type: 'string' },
        includeKsi: { type: 'boolean' },
        evidenceType: { type: 'string' },
        externalUri: { type: 'string' },
        sourceRunId: { type: 'string' },
        sourceConnector: { type: 'string' },
        idempotencyKey: { type: 'string' },
        metadata: { type: 'object' },
        assertion: { type: 'object' },
        autoScopeOptions: { type: 'object' },
      },
    },
  },
];

export async function handle(name, args) {
  if (name !== 'evidence_link_project_bootstrap_verify_v1') return null;
  const result = await evidenceLinkProjectBootstrapVerifyV1(args);
  return textResult(result);
}
