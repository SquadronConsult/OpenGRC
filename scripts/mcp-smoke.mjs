/* eslint-disable no-console */
import path from 'path';
import { pathToFileURL } from 'url';

async function run() {
  process.env.OPEN_GRC_API_URL = process.env.OPEN_GRC_API_URL || 'http://localhost:3000';
  const repoModule = await import(
    pathToFileURL(
      path.resolve('apps/mcp-server/src/utils/repo.mjs'),
    ).href
  );
  const skillsModule = await import(
    pathToFileURL(
      path.resolve('apps/mcp-server/src/skills/catalog.mjs'),
    ).href
  );
  const grcModule = await import(
    pathToFileURL(
      path.resolve('apps/mcp-server/src/utils/opengrc.mjs'),
    ).href
  );

  const inventory = await repoModule.scanRepoInventory(path.resolve('.'), {
    maxFiles: 1200,
  });
  if (!inventory.fileCount || inventory.fileCount <= 0) {
    throw new Error('repo inventory failed');
  }

  const skills = skillsModule.selectSkills({
    objective: 'secure coding',
    inventory,
  });
  if (!Array.isArray(skills) || skills.length === 0) {
    throw new Error('skill selection failed');
  }

  const sync = await grcModule.syncGrcEvidence({
    checklistItemId: 'smoke-checklist-item-id',
    scanner: 'mcp-smoke',
  });
  if (!sync || typeof sync !== 'object') {
    throw new Error('sync_grc_evidence_v1 helper failed');
  }

  const taxonomy = await grcModule.getFrmrTaxonomy({ pathType: '20x' });
  if (!taxonomy || typeof taxonomy !== 'object') {
    throw new Error('frmr taxonomy helper failed');
  }

  let projectChain = { skipped: true, reason: 'INTEGRATION_API_KEY not configured' };
  let oscalReport = { skipped: true, reason: 'INTEGRATION_API_KEY not configured' };
  if (process.env.INTEGRATION_API_KEY) {
    projectChain = await grcModule.evidenceLinkProjectBootstrapVerifyV1({
      name: `MCP Smoke ${new Date().toISOString()}`,
      pathType: '20x',
      impactLevel: 'moderate',
      includeKsi: true,
      evidenceType: 'mcp_smoke_chain',
      sourceConnector: 'mcp_smoke',
      metadata: { smoke: true },
      autoScopeOptions: { mode: 'recommendation_only' },
    });
    if (!projectChain?.projectId) {
      throw new Error('project bootstrap smoke chain did not return projectId');
    }
    if (!projectChain?.evidenceIngest) {
      throw new Error('project bootstrap smoke chain missing evidence ingest result');
    }

    oscalReport = await grcModule.fedrampOscalReportV1({
      projectId: projectChain.projectId,
      pathType: '20x',
      evidenceRequestIds: [projectChain?.evidenceIngest?.requestId].filter(Boolean),
      autoScopeRunIds: [projectChain?.autoScope?.run?.runId].filter(Boolean),
    });
    if (!oscalReport?.exports?.ssp || !oscalReport?.exports?.poam) {
      throw new Error('OSCAL report helper did not return both SSP and POA&M exports');
    }
  }

  console.log(
    `OK mcp-smoke files=${inventory.fileCount} skills=${skills.length} syncSkipped=${Boolean(
      sync.skipped,
    )} taxonomyProcesses=${Array.isArray(taxonomy?.processes) ? taxonomy.processes.length : 0} chainSkipped=${Boolean(projectChain.skipped)} chainOk=${Boolean(projectChain.ok)} reportSkipped=${Boolean(oscalReport.skipped)}`,
  );
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
