import { Injectable } from '@nestjs/common';
import type {
  ConnectorCollectResult,
  ConnectorContext,
  EvidenceConnector,
} from '../connector.types';

/** Teams incoming webhook test (similar to Slack). */
@Injectable()
export class TeamsConnector implements EvidenceConnector {
  readonly id = 'teams_webhook';
  readonly version = '1.0.0';

  async collect(ctx: ConnectorContext): Promise<ConnectorCollectResult> {
    const webhookUrl = String(ctx.config.webhookUrl || '');
    const framework = String(ctx.config.framework || 'frmr');
    const controlId = String(ctx.config.defaultControlId || 'notify:teams');

    if (!webhookUrl) {
      return {
        items: [
          {
            framework,
            controlId,
            evidenceType: 'teams_config',
            sourceConnector: 'teams_webhook',
            occurredAt: new Date().toISOString(),
            sourceRunId: ctx.runId,
            metadata: { configured: false, automated: true },
            assertion: { status: 'warn', message: 'Teams webhook URL not set' },
          },
        ],
      };
    }

    if (ctx.config.sendTest !== true && ctx.config.sendTest !== 'true') {
      return {
        items: [
          {
            framework,
            controlId,
            evidenceType: 'teams_config',
            sourceConnector: 'teams_webhook',
            occurredAt: new Date().toISOString(),
            sourceRunId: ctx.runId,
            metadata: { configured: true, automated: true, testSkipped: true },
            assertion: { status: 'info', message: 'Webhook configured; set sendTest=true to post' },
          },
        ],
      };
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        '@type': 'MessageCard',
        text: `OpenGRC connector test ${ctx.runId}`,
      }),
    });

    return {
      items: [
        {
          framework,
          controlId,
          evidenceType: 'teams_webhook_test',
          sourceConnector: 'teams_webhook',
          occurredAt: new Date().toISOString(),
          sourceRunId: ctx.runId,
          metadata: { httpStatus: res.status, automated: true },
          assertion: { status: res.ok ? 'pass' : 'fail', message: 'Teams webhook POST' },
        },
      ],
      diagnostics: { status: res.status },
    };
  }
}
