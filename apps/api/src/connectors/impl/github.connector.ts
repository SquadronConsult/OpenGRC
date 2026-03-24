import { Injectable, Logger } from '@nestjs/common';
import type {
  ConnectorCollectResult,
  ConnectorContext,
  EvidenceConnector,
} from '../connector.types';

@Injectable()
export class GithubConnector implements EvidenceConnector {
  readonly id = 'github_repo';
  readonly version = '1.0.0';
  private readonly log = new Logger(GithubConnector.name);

  async collect(ctx: ConnectorContext): Promise<ConnectorCollectResult> {
    const token = String(ctx.config.token || ctx.config.githubToken || '');
    const owner = String(ctx.config.owner || '');
    const repo = String(ctx.config.repo || '');
    const branch = String(ctx.config.defaultBranch || 'main');
    const framework = String(ctx.config.framework || 'frmr');
    const controlId = String(ctx.config.defaultControlId || 'nist:SI-2');
    const base = String(ctx.config.githubApiBase || 'https://api.github.com');

    if (!owner || !repo) {
      return {
        items: [],
        diagnostics: { error: 'owner and repo are required in config' },
      };
    }

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const items: ConnectorCollectResult['items'] = [];
    const diag: Record<string, unknown> = { owner, repo };

    try {
      const repoRes = await fetch(`${base}/repos/${owner}/${repo}`, { headers });
      const repoJson = repoRes.ok ? await repoRes.json() : null;
      diag.repoStatus = repoRes.status;
      if (repoJson && typeof repoJson === 'object') {
        items.push({
          framework,
          controlId,
          evidenceType: 'repo_metadata',
          externalUri: (repoJson as { html_url?: string }).html_url,
          sourceConnector: 'github_repo',
          occurredAt: new Date().toISOString(),
          sourceRunId: ctx.runId,
          artifactType: 'config_snapshot',
          sourceSystem: 'github',
          metadata: {
            default_branch: (repoJson as { default_branch?: string }).default_branch,
            visibility: (repoJson as { visibility?: string }).visibility,
            automated: true,
            provider: 'github',
          },
          assertion: { status: 'info', message: 'Repository metadata snapshot' },
        });
      }

      const protPath = `${base}/repos/${owner}/${repo}/branches/${branch}/protection`;
      const protRes = await fetch(protPath, { headers });
      diag.branchProtectionStatus = protRes.status;
      if (protRes.ok) {
        const prot = await protRes.json();
        items.push({
          framework,
          controlId,
          evidenceType: 'branch_protection',
          externalUri: `${(repoJson as { html_url?: string })?.html_url || ''}/settings/branch_protection_rules`,
          sourceConnector: 'github_repo',
          occurredAt: new Date().toISOString(),
          sourceRunId: ctx.runId,
          artifactType: 'config_snapshot',
          sourceSystem: 'github',
          metadata: {
            branch,
            protection: prot,
            automated: true,
          },
          assertion: { status: 'pass', message: 'Branch protection settings retrieved' },
        });
      }

      const scanPath = `${base}/repos/${owner}/${repo}/code-scanning/alerts`;
      const scanRes = await fetch(`${scanPath}?per_page=5&state=open`, { headers });
      diag.codeScanningStatus = scanRes.status;
      if (scanRes.ok) {
        const alerts = await scanRes.json();
        items.push({
          framework,
          controlId: String(ctx.config.scanControlId || controlId),
          evidenceType: 'code_scanning',
          externalUri: `${(repoJson as { html_url?: string })?.html_url || ''}/security/code-scanning`,
          sourceConnector: 'github_repo',
          occurredAt: new Date().toISOString(),
          sourceRunId: ctx.runId,
          artifactType: 'scan',
          sourceSystem: 'github',
          metadata: {
            openAlertsSample: Array.isArray(alerts) ? alerts.slice(0, 5) : alerts,
            automated: true,
          },
          assertion: {
            status: Array.isArray(alerts) && alerts.length ? 'warn' : 'pass',
            message: 'Code scanning alerts snapshot',
          },
        });
      }
    } catch (e) {
      this.log.warn(`GitHub collect error: ${e}`);
      diag.fetchError = e instanceof Error ? e.message : String(e);
    }

    return { items, nextCursor: null, diagnostics: diag };
  }
}
