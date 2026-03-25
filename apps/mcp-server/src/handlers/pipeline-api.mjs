import { textResult } from '../helpers.mjs';
import { integrationPipelineCheckV1 } from '../utils/opengrc.mjs';

export const tools = [
  {
    name: 'pipeline_check_v1',
    description:
      'CI gate: compare project readiness % against a threshold; records a pipeline check row.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId'],
      properties: {
        projectId: { type: 'string' },
        minReadinessPct: { type: 'number', description: 'Default 80' },
      },
    },
  },
];

export async function handle(name, args) {
  if (name === 'pipeline_check_v1') {
    const result = await integrationPipelineCheckV1({
      projectId: String(args.projectId),
      minReadinessPct: args.minReadinessPct,
    });
    return textResult(result);
  }
  return null;
}
