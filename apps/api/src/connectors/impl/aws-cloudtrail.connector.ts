import { Injectable, Logger } from '@nestjs/common';
import {
  CloudTrailClient,
  LookupEventsCommand,
} from '@aws-sdk/client-cloudtrail';
import type {
  ConnectorCollectResult,
  ConnectorContext,
  EvidenceConnector,
} from '../connector.types';

@Injectable()
export class AwsCloudTrailConnector implements EvidenceConnector {
  readonly id = 'aws_cloudtrail';
  readonly version = '1.0.0';
  private readonly log = new Logger(AwsCloudTrailConnector.name);

  async collect(ctx: ConnectorContext): Promise<ConnectorCollectResult> {
    const region = String(ctx.config.region || 'us-east-1');
    const framework = String(ctx.config.framework || 'frmr');
    const controlId = String(ctx.config.defaultControlId || 'nist:AU-2');

    const accessKeyId = ctx.config.accessKeyId ? String(ctx.config.accessKeyId) : '';
    const secretAccessKey = ctx.config.secretAccessKey
      ? String(ctx.config.secretAccessKey)
      : '';

    if (!accessKeyId || !secretAccessKey) {
      return {
        items: [],
        diagnostics: {
          error: 'accessKeyId and secretAccessKey required in config (or use instance role in future)',
        },
      };
    }

    const client = new CloudTrailClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
        sessionToken: ctx.config.sessionToken ? String(ctx.config.sessionToken) : undefined,
      },
    });

    const end = new Date();
    const start = ctx.cursor
      ? new Date(ctx.cursor)
      : new Date(end.getTime() - 60 * 60 * 1000);

    try {
      const out = await client.send(
        new LookupEventsCommand({
          StartTime: start,
          EndTime: end,
          MaxResults: 20,
        }),
      );
      const events = out.Events || [];
      const nextCursor = end.toISOString();
      return {
        items: [
          {
            framework,
            controlId,
            evidenceType: 'cloudtrail_window',
            sourceConnector: 'aws_cloudtrail',
            occurredAt: end.toISOString(),
            sourceRunId: ctx.runId,
            artifactType: 'log_aggregate',
            sourceSystem: 'aws_cloudtrail',
            collectionStart: start.toISOString(),
            collectionEnd: end.toISOString(),
            metadata: {
              region,
              eventCount: events.length,
              sample: events.slice(0, 5).map((e) => ({
                EventName: e.EventName,
                EventTime: e.EventTime?.toISOString(),
                Username: e.Username,
              })),
              automated: true,
            },
            assertion: {
              status: 'info',
              message: `CloudTrail lookup: ${events.length} events in window`,
            },
          },
        ],
        nextCursor,
        diagnostics: { region, eventCount: events.length },
      };
    } catch (e) {
      this.log.warn(`CloudTrail error: ${e}`);
      return {
        items: [],
        diagnostics: { error: e instanceof Error ? e.message : String(e) },
      };
    }
  }
}
