import type { EvidenceAssertionDto } from '../integrations/dto/integration-v1.dto';

export type ConnectorContext = {
  projectId: string;
  instanceId: string;
  runId: string;
  connectorId: string;
  config: Record<string, unknown>;
  cursor: string | null;
};

/** Rich output from a connector; orchestrator maps to EvidenceUpsertItemDto. */
export type ConnectorEvidenceRecord = {
  framework?: string;
  controlId: string;
  checklistItemId?: string;
  evidenceType?: string;
  externalUri?: string;
  sourceRunId?: string;
  occurredAt?: string;
  sourceConnector: string;
  metadata?: Record<string, unknown>;
  assertion?: EvidenceAssertionDto;
  artifactType?: string;
  sourceSystem?: string;
  collectionStart?: string;
  collectionEnd?: string;
};

export type ConnectorCollectResult = {
  items: ConnectorEvidenceRecord[];
  nextCursor?: string | null;
  diagnostics?: Record<string, unknown>;
};

export interface EvidenceConnector {
  readonly id: string;
  readonly version: string;
  collect(ctx: ConnectorContext): Promise<ConnectorCollectResult>;
}
