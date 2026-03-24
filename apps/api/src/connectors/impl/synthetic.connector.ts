import { Injectable } from '@nestjs/common';
import type {
  ConnectorCollectResult,
  ConnectorContext,
  EvidenceConnector,
} from '../connector.types';

@Injectable()
export class SyntheticConnector implements EvidenceConnector {
  readonly id = 'synthetic';
  readonly version = '1.0.0';

  async collect(ctx: ConnectorContext): Promise<ConnectorCollectResult> {
    const controlId = String(ctx.config.defaultControlId || 'synthetic:health');
    const framework = String(ctx.config.framework || 'frmr');
    return {
      items: [
        {
          framework,
          controlId,
          evidenceType: 'synthetic_check',
          sourceConnector: 'synthetic',
          occurredAt: new Date().toISOString(),
          sourceRunId: ctx.runId,
          assertion: { status: 'pass', message: 'Synthetic connector heartbeat' },
          metadata: {
            connectorInstanceId: ctx.instanceId,
            stub: true,
          },
        },
      ],
      nextCursor: null,
      diagnostics: { mode: 'synthetic' },
    };
  }
}
