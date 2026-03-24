import { Injectable, Logger } from '@nestjs/common';
import {
  ConfigServiceClient,
  DescribeConfigurationRecordersCommand,
  DescribeComplianceByConfigRuleCommand,
} from '@aws-sdk/client-config-service';
import type {
  ConnectorCollectResult,
  ConnectorContext,
  EvidenceConnector,
} from '../connector.types';

@Injectable()
export class AwsConfigConnector implements EvidenceConnector {
  readonly id = 'aws_config';
  readonly version = '1.0.0';
  private readonly log = new Logger(AwsConfigConnector.name);

  async collect(ctx: ConnectorContext): Promise<ConnectorCollectResult> {
    const region = String(ctx.config.region || 'us-east-1');
    const framework = String(ctx.config.framework || 'frmr');
    const controlId = String(ctx.config.defaultControlId || 'nist:CM-6');

    const accessKeyId = ctx.config.accessKeyId ? String(ctx.config.accessKeyId) : '';
    const secretAccessKey = ctx.config.secretAccessKey
      ? String(ctx.config.secretAccessKey)
      : '';

    if (!accessKeyId || !secretAccessKey) {
      return {
        items: [],
        diagnostics: {
          error: 'accessKeyId and secretAccessKey required in config',
        },
      };
    }

    const client = new ConfigServiceClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
        sessionToken: ctx.config.sessionToken ? String(ctx.config.sessionToken) : undefined,
      },
    });

    try {
      const rec = await client.send(new DescribeConfigurationRecordersCommand({}));
      const compliance = await client
        .send(
          new DescribeComplianceByConfigRuleCommand({}),
        )
        .catch(() => null);

      const rules = compliance?.ComplianceByConfigRules || [];
      const nonCompliant = rules.filter((r) => r.Compliance?.ComplianceType === 'NON_COMPLIANT');

      return {
        items: [
          {
            framework,
            controlId,
            evidenceType: 'aws_config_snapshot',
            sourceConnector: 'aws_config',
            occurredAt: new Date().toISOString(),
            sourceRunId: ctx.runId,
            artifactType: 'config_snapshot',
            sourceSystem: 'aws_config',
            metadata: {
              region,
              recorders: rec.ConfigurationRecorders?.map((c) => c.name) || [],
              complianceRulesSample: rules.slice(0, 10).map((r) => ({
                name: r.ConfigRuleName,
                type: r.Compliance?.ComplianceType,
              })),
              nonCompliantCount: nonCompliant.length,
              automated: true,
            },
            assertion: {
              status: nonCompliant.length ? 'warn' : 'pass',
              message: `AWS Config compliance snapshot (${rules.length} rules reviewed in page)`,
            },
          },
        ],
        nextCursor: null,
        diagnostics: { region, rulePageSize: rules.length },
      };
    } catch (e) {
      this.log.warn(`AWS Config error: ${e}`);
      return {
        items: [],
        diagnostics: { error: e instanceof Error ? e.message : String(e) },
      };
    }
  }
}
