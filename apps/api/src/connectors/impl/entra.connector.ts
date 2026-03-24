import { Injectable, Logger } from '@nestjs/common';
import type {
  ConnectorCollectResult,
  ConnectorContext,
  EvidenceConnector,
} from '../connector.types';

@Injectable()
export class EntraConnector implements EvidenceConnector {
  readonly id = 'entra_id';
  readonly version = '1.0.0';
  private readonly log = new Logger(EntraConnector.name);

  async collect(ctx: ConnectorContext): Promise<ConnectorCollectResult> {
    const tenantId = String(ctx.config.tenantId || '');
    const clientId = String(ctx.config.clientId || '');
    const clientSecret = String(ctx.config.clientSecret || '');
    const framework = String(ctx.config.framework || 'frmr');
    const controlId = String(ctx.config.defaultControlId || 'nist:IA-2');

    if (!tenantId || !clientId || !clientSecret) {
      return {
        items: [],
        diagnostics: { error: 'tenantId, clientId, clientSecret required for Graph token' },
      };
    }

    try {
      const tokenRes = await fetch(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            scope: 'https://graph.microsoft.com/.default',
            grant_type: 'client_credentials',
          }),
        },
      );
      const tok = tokenRes.ok ? await tokenRes.json() : null;
      const access = tok && typeof tok === 'object' ? (tok as { access_token?: string }).access_token : undefined;
      if (!access) {
        return {
          items: [],
          diagnostics: { error: 'Failed to obtain Graph token', status: tokenRes.status },
        };
      }

      const org = await fetch('https://graph.microsoft.com/v1.organization', {
        headers: { Authorization: `Bearer ${access}` },
      });
      const orgJson = org.ok ? await org.json() : null;

      return {
        items: [
          {
            framework,
            controlId,
            evidenceType: 'entra_org_snapshot',
            sourceConnector: 'entra_id',
            occurredAt: new Date().toISOString(),
            sourceRunId: ctx.runId,
            artifactType: 'config_snapshot',
            sourceSystem: 'microsoft_entra',
            metadata: {
              organization: orgJson,
              automated: true,
            },
            assertion: { status: 'info', message: 'Microsoft Entra organization snapshot' },
          },
        ],
        nextCursor: null,
        diagnostics: { graphStatus: org.status },
      };
    } catch (e) {
      this.log.warn(`Entra: ${e}`);
      return { items: [], diagnostics: { error: String(e) } };
    }
  }
}
