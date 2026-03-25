import { textResult } from '../helpers.mjs';
import {
  connectorsListV1,
  connectorsRegistryV1,
  connectorsStatusV1,
  connectorsRunV1,
  connectorsRunsV1,
  connectorsCreateV1,
} from '../utils/opengrc.mjs';

export const tools = [
  {
    name: 'connectors_registry_v1',
    description:
      'List built-in connector types (id, version) available for a project. Connectors pull scanner or repo artifacts into OpenGRC for checklist mapping.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId'],
      properties: { projectId: { type: 'string' } },
    },
  },
  {
    name: 'connectors_list_v1',
    description:
      'List configured connector instances for a project (secrets redacted).',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId'],
      properties: { projectId: { type: 'string' } },
    },
  },
  {
    name: 'connectors_status_v1',
    description:
      'Summarize connector health, stale evidence flags, and last run errors.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId'],
      properties: { projectId: { type: 'string' } },
    },
  },
  {
    name: 'connectors_run_v1',
    description: 'Trigger a manual collection run for one connector instance.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId', 'instanceId'],
      properties: {
        projectId: { type: 'string' },
        instanceId: { type: 'string' },
      },
    },
  },
  {
    name: 'connectors_runs_v1',
    description: 'Inspect recent run history for one connector instance.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId', 'instanceId'],
      properties: {
        projectId: { type: 'string' },
        instanceId: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'connectors_create_v1',
    description:
      'Create a connector instance (e.g. GitHub, synthetic, AWS) with JSON config.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId', 'connectorId', 'label'],
      properties: {
        projectId: { type: 'string' },
        connectorId: { type: 'string' },
        label: { type: 'string' },
        enabled: { type: 'boolean' },
        config: { type: 'object' },
      },
    },
  },
];

const MAP = {
  connectors_registry_v1: connectorsRegistryV1,
  connectors_list_v1: connectorsListV1,
  connectors_status_v1: connectorsStatusV1,
  connectors_run_v1: connectorsRunV1,
  connectors_runs_v1: connectorsRunsV1,
  connectors_create_v1: connectorsCreateV1,
};

export async function handle(name, args) {
  const fn = MAP[name];
  if (!fn) return null;
  const result = await fn(args);
  return textResult(result);
}
