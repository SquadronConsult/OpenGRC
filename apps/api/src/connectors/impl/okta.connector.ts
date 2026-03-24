import { Injectable, Logger } from '@nestjs/common';
import type {
  ConnectorCollectResult,
  ConnectorContext,
  EvidenceConnector,
} from '../connector.types';

@Injectable()
export class OktaConnector implements EvidenceConnector {
  readonly id = 'okta_org';
  readonly version = '1.0.0';
  private readonly log = new Logger(OktaConnector.name);

  async collect(ctx: ConnectorContext): Promise<ConnectorCollectResult> {
    const base = String(ctx.config.oktaDomain || ctx.config.domain || '').replace(/\/$/, '');
    const token = String(ctx.config.apiToken || '');
    const framework = String(ctx.config.framework || 'frmr');
    const controlId = String(ctx.config.defaultControlId || 'nist:IA-2');

    if (!base || !token) {
      return {
        items: [],
        diagnostics: { error: 'oktaDomain and apiToken required' },
      };
    }

    const url = `${base.startsWith('http') ? base : `https://${base}`}/api/v1/org`;
    try {
      const res = await fetch(url, {
        headers: { Authorization: `SSWS ${token}`, Accept: 'application/json' },
      });
      const body = res.ok ? await res.json() : null;
      return {
        items: [
          {
            framework,
            controlId,
            evidenceType: 'okta_org_snapshot',
            externalUri: base,
            sourceConnector: 'okta_org',
            occurredAt: new Date().toISOString(),
            sourceRunId: ctx.runId,
            artifactType: 'config_snapshot',
            sourceSystem: 'okta',
            metadata: {
              orgStatus: body,
              automated: true,
            },
            assertion: { status: res.ok ? 'info' : 'fail', message: 'Okta org API' },
          },
        ],
        nextCursor: null,
        diagnostics: { status: res.status },
      };
    } catch (e) {
      this.log.warn(`Okta: ${e}`);
      return { items: [], diagnostics: { error: String(e) } };
    }
  }
}
