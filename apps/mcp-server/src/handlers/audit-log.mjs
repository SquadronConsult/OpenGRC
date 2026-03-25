import { readRunLog } from '../utils/audit.mjs';
import { textResult } from '../helpers.mjs';

export const tools = [
  {
    name: 'get_run_log_v1',
    description: 'Retrieve audit timeline for a remediation run.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['runId'],
      properties: {
        runId: { type: 'string' },
      },
    },
  },
];

export async function handle(name, args) {
  if (name !== 'get_run_log_v1') return null;
  const logs = await readRunLog(args.runId);
  return textResult({ runId: args.runId, events: logs });
}
