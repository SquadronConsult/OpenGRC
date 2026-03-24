import { Injectable, Logger } from '@nestjs/common';
import type {
  ConnectorCollectResult,
  ConnectorContext,
  EvidenceConnector,
} from '../connector.types';

@Injectable()
export class JiraConnector implements EvidenceConnector {
  readonly id = 'jira_cloud';
  readonly version = '1.0.0';
  private readonly log = new Logger(JiraConnector.name);

  async collect(ctx: ConnectorContext): Promise<ConnectorCollectResult> {
    const host = String(ctx.config.host || '').replace(/\/$/, '');
    const email = String(ctx.config.email || '');
    const apiToken = String(ctx.config.apiToken || '');
    const jql = String(ctx.config.jql || 'order by updated DESC');
    const framework = String(ctx.config.framework || 'frmr');
    const controlId = String(ctx.config.defaultControlId || 'poam:ticket');

    if (!host || !email || !apiToken) {
      return { items: [], diagnostics: { error: 'host, email, apiToken required' } };
    }

    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const base = host.startsWith('http') ? host : `https://${host}`;

    try {
      const res = await fetch(
        `${base}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=10`,
        { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } },
      );
      const data = res.ok ? await res.json() : null;
      const issues = data && typeof data === 'object' ? (data as { issues?: unknown[] }).issues : [];

      return {
        items: [
          {
            framework,
            controlId,
            evidenceType: 'jira_query',
            externalUri: base,
            sourceConnector: 'jira_cloud',
            occurredAt: new Date().toISOString(),
            sourceRunId: ctx.runId,
            metadata: {
              jql,
              issueCount: Array.isArray(issues) ? issues.length : 0,
              automated: true,
            },
            assertion: { status: res.ok ? 'info' : 'fail', message: 'Jira JQL snapshot' },
          },
        ],
        nextCursor: null,
        diagnostics: { status: res.status },
      };
    } catch (e) {
      this.log.warn(`Jira: ${e}`);
      return { items: [], diagnostics: { error: String(e) } };
    }
  }
}
