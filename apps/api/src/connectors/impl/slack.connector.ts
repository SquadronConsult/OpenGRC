import { Injectable, Logger } from '@nestjs/common';
import type {
  ConnectorCollectResult,
  ConnectorContext,
  EvidenceConnector,
} from '../connector.types';

/**
 * Primarily for alerting; collect verifies webhook URL by sending a test payload when configured.
 */
@Injectable()
export class SlackConnector implements EvidenceConnector {
  readonly id = 'slack_webhook';
  readonly version = '1.0.0';
  private readonly log = new Logger(SlackConnector.name);

  async collect(ctx: ConnectorContext): Promise<ConnectorCollectResult> {
    const webhookUrl = String(ctx.config.webhookUrl || '');
    const framework = String(ctx.config.framework || 'frmr');
    const controlId = String(ctx.config.defaultControlId || 'notify:slack');

    if (!webhookUrl) {
      return {
        items: [
          {
            framework,
            controlId,
            evidenceType: 'slack_config',
            sourceConnector: 'slack_webhook',
            occurredAt: new Date().toISOString(),
            sourceRunId: ctx.runId,
            metadata: { configured: false, automated: true },
            assertion: { status: 'warn', message: 'Slack webhook URL not set' },
          },
        ],
        diagnostics: { skipped: true },
      };
    }

    if (ctx.config.sendTest !== true && ctx.config.sendTest !== 'true') {
      return {
        items: [
          {
            framework,
            controlId,
            evidenceType: 'slack_config',
            sourceConnector: 'slack_webhook',
            occurredAt: new Date().toISOString(),
            sourceRunId: ctx.runId,
            metadata: { configured: true, automated: true, testSkipped: true },
            assertion: { status: 'info', message: 'Webhook configured; set sendTest=true to post' },
          },
        ],
        nextCursor: null,
      };
    }

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `OpenGRC connector test run ${ctx.runId}`,
        }),
      });
      return {
        items: [
          {
            framework,
            controlId,
            evidenceType: 'slack_webhook_test',
            sourceConnector: 'slack_webhook',
            occurredAt: new Date().toISOString(),
            sourceRunId: ctx.runId,
            metadata: { httpStatus: res.status, automated: true },
            assertion: { status: res.ok ? 'pass' : 'fail', message: 'Slack webhook POST' },
          },
        ],
        nextCursor: null,
        diagnostics: { status: res.status },
      };
    } catch (e) {
      this.log.warn(`Slack: ${e}`);
      return { items: [], diagnostics: { error: String(e) } };
    }
  }
}
