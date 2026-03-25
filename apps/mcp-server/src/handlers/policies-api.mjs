import { textResult } from '../helpers.mjs';
import {
  integrationPoliciesCreateV1,
  integrationPoliciesUpdateV1,
  integrationPoliciesPublishV1,
  integrationPoliciesGenerateV1,
} from '../utils/opengrc.mjs';

export const tools = [
  {
    name: 'policies_create_v1',
    description: 'Create a draft policy (project-scoped or global when projectId null).',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      required: ['title'],
      properties: {
        projectId: { type: ['string', 'null'] },
        title: { type: 'string' },
        category: { type: 'string' },
        content: { type: 'string' },
      },
    },
  },
  {
    name: 'policies_update_v1',
    description: 'Patch policy metadata and content.',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      required: ['policyId'],
      properties: {
        policyId: { type: 'string' },
        title: { type: 'string' },
        category: { type: 'string' },
        content: { type: 'string' },
        status: { type: 'string' },
      },
    },
  },
  {
    name: 'policies_publish_v1',
    description: 'Publish a policy version (snapshot + published status).',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['policyId'],
      properties: {
        policyId: { type: 'string' },
        changeDescription: { type: 'string' },
      },
    },
  },
  {
    name: 'policies_generate_v1',
    description:
      'Generate draft policies from built-in templates for a project (skips titles already present).',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      required: ['projectId'],
      properties: {
        projectId: { type: 'string' },
        slugs: { type: 'array', items: { type: 'string' } },
        organizationName: { type: 'string' },
        systemName: { type: 'string' },
      },
    },
  },
];

export async function handle(name, args) {
  if (name === 'policies_create_v1') {
    const result = await integrationPoliciesCreateV1(args || {});
    return textResult(result);
  }
  if (name === 'policies_update_v1') {
    const { policyId, ...body } = args || {};
    const result = await integrationPoliciesUpdateV1(String(policyId), body);
    return textResult(result);
  }
  if (name === 'policies_publish_v1') {
    const { policyId, changeDescription } = args || {};
    const result = await integrationPoliciesPublishV1(String(policyId), {
      changeDescription,
    });
    return textResult(result);
  }
  if (name === 'policies_generate_v1') {
    const result = await integrationPoliciesGenerateV1(args || {});
    return textResult(result);
  }
  return null;
}
