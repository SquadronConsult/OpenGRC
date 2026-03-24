import { Injectable, Logger } from '@nestjs/common';
import type {
  ConnectorCollectResult,
  ConnectorContext,
  EvidenceConnector,
} from '../connector.types';

@Injectable()
export class LinearConnector implements EvidenceConnector {
  readonly id = 'linear_workspace';
  readonly version = '1.0.0';
  private readonly log = new Logger(LinearConnector.name);

  async collect(ctx: ConnectorContext): Promise<ConnectorCollectResult> {
    const apiKey = String(ctx.config.apiKey || '');
    const framework = String(ctx.config.framework || 'frmr');
    const controlId = String(ctx.config.defaultControlId || 'poam:ticket');

    if (!apiKey) {
      return { items: [], diagnostics: { error: 'apiKey required' } };
    }

    const query = `query { viewer { id name } }`;
    try {
      const res = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      const data = res.ok ? await res.json() : null;

      return {
        items: [
          {
            framework,
            controlId,
            evidenceType: 'linear_viewer',
            sourceConnector: 'linear_workspace',
            occurredAt: new Date().toISOString(),
            sourceRunId: ctx.runId,
            metadata: {
              viewer: data,
              automated: true,
            },
            assertion: { status: res.ok ? 'info' : 'fail', message: 'Linear GraphQL viewer' },
          },
        ],
        nextCursor: null,
        diagnostics: { status: res.status },
      };
    } catch (e) {
      this.log.warn(`Linear: ${e}`);
      return { items: [], diagnostics: { error: String(e) } };
    }
  }
}
