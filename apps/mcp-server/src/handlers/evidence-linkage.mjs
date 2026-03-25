import { textResult } from '../helpers.mjs';
import {
  syncGrcEvidence,
  evidenceLinkUpsertV1,
  evidenceLinkBulkIngestV1,
  evidenceLinkLookupControlV1,
  evidenceLinkIngestStatusV1,
  evidenceLinkTriggerAutoScopeV1,
  evidenceLinkMapControlV1,
} from '../utils/opengrc.mjs';

export const tools = [
  {
    name: 'sync_grc_evidence_v1',
    description:
      'Push remediation/security evidence summary into OpenGRC integrations endpoint.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['checklistItemId'],
      properties: {
        checklistItemId: { type: 'string' },
        scanner: { type: 'string' },
        critical: { type: 'number' },
        high: { type: 'number' },
        medium: { type: 'number' },
        low: { type: 'number' },
        reportUrl: { type: 'string' },
      },
    },
  },
  {
    name: 'evidence_link_upsert_v1',
    description:
      'Create or upsert single evidence linkage using project-scoped integration endpoint.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId', 'controlId'],
      properties: {
        projectId: { type: 'string' },
        framework: { type: 'string', default: 'frmr' },
        controlId: { type: 'string' },
        checklistItemId: { type: 'string' },
        evidenceType: { type: 'string' },
        externalUri: { type: 'string' },
        sourceRunId: { type: 'string' },
        occurredAt: { type: 'string' },
        sourceConnector: { type: 'string' },
        metadata: { type: 'object' },
        assertion: { type: 'object' },
        idempotencyKey: { type: 'string' },
      },
    },
  },
  {
    name: 'evidence_link_bulk_ingest_v1',
    description:
      'Bulk ingest evidence links with accepted/rejected detail and idempotency support.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId', 'items'],
      properties: {
        projectId: { type: 'string' },
        idempotencyKey: { type: 'string' },
        items: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['controlId'],
            properties: {
              framework: { type: 'string', default: 'frmr' },
              controlId: { type: 'string' },
              checklistItemId: { type: 'string' },
              evidenceType: { type: 'string' },
              externalUri: { type: 'string' },
              sourceRunId: { type: 'string' },
              occurredAt: { type: 'string' },
              sourceConnector: { type: 'string' },
              metadata: { type: 'object' },
              assertion: { type: 'object' },
            },
          },
        },
      },
    },
  },
  {
    name: 'evidence_link_lookup_control_v1',
    description: 'Resolve framework control reference to an internal checklist item.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId', 'controlId'],
      properties: {
        projectId: { type: 'string' },
        framework: { type: 'string', default: 'frmr' },
        controlId: { type: 'string' },
      },
    },
  },
  {
    name: 'evidence_link_map_control_v1',
    description: 'Create or update explicit control-to-checklist mapping link.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId', 'checklistItemId', 'controlId'],
      properties: {
        projectId: { type: 'string' },
        checklistItemId: { type: 'string' },
        framework: { type: 'string', default: 'frmr' },
        controlId: { type: 'string' },
        notes: { type: 'string' },
      },
    },
  },
  {
    name: 'evidence_link_ingest_status_v1',
    description: 'Fetch status/result payload for a prior idempotent ingest request.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId', 'requestId'],
      properties: {
        projectId: { type: 'string' },
        requestId: { type: 'string' },
      },
    },
  },
  {
    name: 'evidence_link_trigger_auto_scope_v1',
    description: 'Trigger auto-scope run via integration endpoint.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId'],
      properties: {
        projectId: { type: 'string' },
        options: { type: 'object' },
      },
    },
  },
];

const NAMES = new Set([
  'sync_grc_evidence_v1',
  'evidence_link_upsert_v1',
  'evidence_link_bulk_ingest_v1',
  'evidence_link_lookup_control_v1',
  'evidence_link_map_control_v1',
  'evidence_link_ingest_status_v1',
  'evidence_link_trigger_auto_scope_v1',
]);

export async function handle(name, args) {
  if (!NAMES.has(name)) return null;

  const map = {
    sync_grc_evidence_v1: syncGrcEvidence,
    evidence_link_upsert_v1: evidenceLinkUpsertV1,
    evidence_link_bulk_ingest_v1: evidenceLinkBulkIngestV1,
    evidence_link_lookup_control_v1: evidenceLinkLookupControlV1,
    evidence_link_map_control_v1: evidenceLinkMapControlV1,
    evidence_link_ingest_status_v1: evidenceLinkIngestStatusV1,
    evidence_link_trigger_auto_scope_v1: evidenceLinkTriggerAutoScopeV1,
  };

  const fn = map[name];
  const result = await fn(args);
  return textResult(result);
}
