import { Injectable, Logger } from '@nestjs/common';
import type {
  ConnectorCollectResult,
  ConnectorContext,
  EvidenceConnector,
} from '../connector.types';

@Injectable()
export class GitlabConnector implements EvidenceConnector {
  readonly id = 'gitlab_repo';
  readonly version = '1.0.0';
  private readonly log = new Logger(GitlabConnector.name);

  async collect(ctx: ConnectorContext): Promise<ConnectorCollectResult> {
    const token = String(ctx.config.token || ctx.config.gitlabToken || '');
    const projectId = encodeURIComponent(String(ctx.config.projectId || ''));
    const base = String(ctx.config.gitlabApiBase || 'https://gitlab.com/api/v4').replace(
      /\/$/,
      '',
    );
    const framework = String(ctx.config.framework || 'frmr');
    const controlId = String(ctx.config.defaultControlId || 'nist:SI-2');

    if (!projectId) {
      return { items: [], diagnostics: { error: 'projectId is required (numeric id or path-encoded)' } };
    }

    const headers: Record<string, string> = {};
    if (token) headers['PRIVATE-TOKEN'] = token;

    const items: ConnectorCollectResult['items'] = [];
    const diag: Record<string, unknown> = {};

    let projectWebUrl: string | undefined;
    try {
      const projRes = await fetch(`${base}/projects/${projectId}`, { headers });
      diag.projectStatus = projRes.status;
      if (projRes.ok) {
        const p = (await projRes.json()) as { web_url?: string; name?: string; visibility?: string };
        projectWebUrl = p.web_url;
        items.push({
          framework,
          controlId,
          evidenceType: 'project_metadata',
          externalUri: p.web_url,
          sourceConnector: 'gitlab_repo',
          occurredAt: new Date().toISOString(),
          sourceRunId: ctx.runId,
          artifactType: 'config_snapshot',
          sourceSystem: 'gitlab',
          metadata: {
            name: p.name,
            visibility: p.visibility,
            automated: true,
          },
          assertion: { status: 'info', message: 'GitLab project metadata' },
        });
      }

      const mrRes = await fetch(
        `${base}/projects/${projectId}/merge_requests?state=opened&per_page=5`,
        { headers },
      );
      diag.mergeRequestsStatus = mrRes.status;
      if (mrRes.ok) {
        const mrs = await mrRes.json();
        items.push({
          framework,
          controlId,
          evidenceType: 'merge_requests',
          externalUri: projectWebUrl,
          sourceConnector: 'gitlab_repo',
          occurredAt: new Date().toISOString(),
          sourceRunId: ctx.runId,
          metadata: { openMrs: Array.isArray(mrs) ? mrs.length : 0, automated: true },
          assertion: { status: 'info', message: 'Open merge requests count' },
        });
      }
    } catch (e) {
      this.log.warn(`GitLab collect error: ${e}`);
      diag.error = e instanceof Error ? e.message : String(e);
    }

    return { items, nextCursor: null, diagnostics: diag };
  }
}
