import { config } from '../config.mjs';

function buildAuthHeader() {
  if (!config.integrationApiKey) {
    throw new Error('INTEGRATION_API_KEY not configured');
  }
  return `Bearer ${config.integrationApiKey}`;
}

async function postJson(path, payload, extraHeaders = {}) {
  const res = await fetch(`${config.opengrcApiUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: buildAuthHeader(),
      ...extraHeaders,
    },
    body: JSON.stringify(payload || {}),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`OpenGRC request failed: ${res.status} ${body}`);
  }
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

async function getJson(path, options = {}) {
  const authEnabled = options.auth !== false;
  const res = await fetch(`${config.opengrcApiUrl}${path}`, {
    method: 'GET',
    headers: authEnabled
      ? {
          authorization: buildAuthHeader(),
        }
      : {},
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`OpenGRC request failed: ${res.status} ${body}`);
  }
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

export async function patchJson(path, payload, extraHeaders = {}) {
  const res = await fetch(`${config.opengrcApiUrl}${path}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: buildAuthHeader(),
      ...extraHeaders,
    },
    body: JSON.stringify(payload ?? {}),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`OpenGRC request failed: ${res.status} ${body}`);
  }
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

export async function deleteJson(path, extraHeaders = {}) {
  const res = await fetch(`${config.opengrcApiUrl}${path}`, {
    method: 'DELETE',
    headers: {
      authorization: buildAuthHeader(),
      ...extraHeaders,
    },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`OpenGRC request failed: ${res.status} ${body}`);
  }
  if (body.length === 0) return { ok: true };
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

const integV1 = '/integrations/v1';

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const q = search.toString();
  return q ? `?${q}` : '';
}

export async function syncGrcEvidence(payload) {
  if (!config.integrationApiKey) {
    return {
      ok: false,
      skipped: true,
      reason: 'INTEGRATION_API_KEY not configured',
    };
  }
  if (!payload?.checklistItemId) {
    throw new Error('checklistItemId is required for sync_grc_evidence_v1');
  }

  const parsed = await postJson('/integrations/scanner/summary', {
      checklistItemId: payload.checklistItemId,
      scanner: payload.scanner || 'mcp-autofix',
      critical: payload.critical || 0,
      high: payload.high || 0,
      medium: payload.medium || 0,
      low: payload.low || 0,
      reportUrl: payload.reportUrl || null,
    });
  return { ok: true, response: parsed };
}

export async function evidenceLinkUpsertV1(payload) {
  if (!payload?.projectId) throw new Error('projectId is required');
  if (!payload?.controlId) throw new Error('controlId is required');
  const headers = {};
  if (payload?.idempotencyKey) {
    headers['idempotency-key'] = String(payload.idempotencyKey);
  }
  return postJson('/integrations/v1/evidence', payload, headers);
}

export async function evidenceLinkBulkIngestV1(payload) {
  if (!payload?.projectId) throw new Error('projectId is required');
  if (!Array.isArray(payload?.items) || payload.items.length === 0) {
    throw new Error('items[] is required');
  }
  const headers = {};
  if (payload?.idempotencyKey) {
    headers['idempotency-key'] = String(payload.idempotencyKey);
  }
  return postJson('/integrations/v1/evidence/bulk', payload, headers);
}

export async function evidenceLinkLookupControlV1(payload) {
  if (!payload?.projectId) throw new Error('projectId is required');
  if (!payload?.controlId) throw new Error('controlId is required');
  return postJson('/integrations/v1/controls/resolve', {
    projectId: payload.projectId,
    framework: payload.framework || 'frmr',
    controlId: payload.controlId,
  });
}

export async function evidenceLinkIngestStatusV1(payload) {
  if (!payload?.projectId) throw new Error('projectId is required');
  if (!payload?.requestId) throw new Error('requestId is required');
  const projectId = encodeURIComponent(payload.projectId);
  const requestId = encodeURIComponent(payload.requestId);
  return getJson(`/integrations/v1/projects/${projectId}/ingest/${requestId}`);
}

export async function evidenceLinkTriggerAutoScopeV1(payload) {
  if (!payload?.projectId) throw new Error('projectId is required');
  return postJson('/integrations/v1/auto-scope/trigger', {
    projectId: payload.projectId,
    options: payload.options || {},
  });
}

export async function evidenceLinkMapControlV1(payload) {
  if (!payload?.projectId) throw new Error('projectId is required');
  if (!payload?.checklistItemId) throw new Error('checklistItemId is required');
  if (!payload?.controlId) throw new Error('controlId is required');
  return postJson('/integrations/v1/controls/link', {
    projectId: payload.projectId,
    checklistItemId: payload.checklistItemId,
    framework: payload.framework || 'frmr',
    controlId: payload.controlId,
    notes: payload.notes || null,
  });
}

export async function createProjectV1(payload) {
  if (!payload?.name) throw new Error('name is required');
  return postJson('/integrations/v1/projects', {
    name: payload.name,
    pathType: payload.pathType,
    impactLevel: payload.impactLevel,
    actorLabels: payload.actorLabels,
    complianceStartDate: payload.complianceStartDate,
    includeKsi: payload.includeKsi,
  });
}

export async function evidenceLinkProjectBootstrapVerifyV1(payload) {
  const diagnostics = [];
  const result = {
    ok: false,
    projectId: null,
    verificationHint: null,
    controlResolution: null,
    controlMapping: null,
    evidenceIngest: null,
    autoScope: null,
    diagnostics,
  };

  try {
    const created = await createProjectV1({
      name: payload?.name || `MCP Verification ${new Date().toISOString()}`,
      pathType: payload?.pathType,
      impactLevel: payload?.impactLevel,
      actorLabels: payload?.actorLabels,
      complianceStartDate: payload?.complianceStartDate,
      includeKsi: payload?.includeKsi,
    });
    const projectId = created?.project?.id || created?.projectId || null;
    const hint = created?.verificationHint || null;
    result.projectId = projectId;
    result.verificationHint = hint;

    if (!projectId) {
      diagnostics.push({ step: 'create_project', error: 'Project ID missing in API response' });
      return result;
    }
    if (!hint?.controlId) {
      diagnostics.push({
        step: 'verification_hint',
        error: 'verificationHint.controlId missing in API response',
      });
      return result;
    }

    if (hint?.checklistItemId) {
      try {
        result.controlMapping = await evidenceLinkMapControlV1({
          projectId,
          checklistItemId: hint.checklistItemId,
          framework: hint.framework || 'frmr',
          controlId: hint.controlId,
          notes: 'auto-mapped by evidence_link_project_bootstrap_verify_v1',
        });
      } catch (error) {
        diagnostics.push({
          step: 'map_control',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    result.controlResolution = await evidenceLinkLookupControlV1({
      projectId,
      framework: hint.framework || 'frmr',
      controlId: hint.controlId,
    });

    const idempotencyKey =
      payload?.idempotencyKey ||
      `mcp-project-verify-${projectId}-${Date.now().toString(36)}`;
    result.evidenceIngest = await evidenceLinkUpsertV1({
      projectId,
      framework: hint.framework || 'frmr',
      controlId: hint.controlId,
      checklistItemId: result.controlResolution?.checklistItemId || hint?.checklistItemId,
      evidenceType: payload?.evidenceType || 'mcp_project_bootstrap_verify',
      externalUri: payload?.externalUri || null,
      sourceRunId: payload?.sourceRunId || `mcp-${Date.now().toString(36)}`,
      sourceConnector: payload?.sourceConnector || 'open_grc_mcp',
      metadata: {
        verificationTool: 'evidence_link_project_bootstrap_verify_v1',
        createdProjectId: projectId,
        ...(payload?.metadata || {}),
      },
      assertion: payload?.assertion || {
        status: 'pass',
        message: 'MCP smoke chain verification evidence',
        measuredAt: new Date().toISOString(),
      },
      idempotencyKey,
    });

    result.autoScope = await evidenceLinkTriggerAutoScopeV1({
      projectId,
      options: payload?.autoScopeOptions || {},
    });

    const accepted =
      Array.isArray(result.evidenceIngest?.accepted) &&
      result.evidenceIngest.accepted.length > 0;
    const autoScopeTriggered = Boolean(
      result.autoScope?.triggered || result.autoScope?.run,
    );
    result.ok = Boolean(projectId && result.controlResolution && accepted && autoScopeTriggered);
    return result;
  } catch (error) {
    diagnostics.push({
      step: 'chain',
      error: error instanceof Error ? error.message : String(error),
    });
    return result;
  }
}

export async function getFrmrTaxonomy(payload = {}) {
  return getJson(
    `/frmr/taxonomy${buildQuery({
      pathType: payload.pathType,
      layer: payload.layer,
      actor: payload.actor,
    })}`,
    { auth: false },
  );
}

/** Generic catalog: registered frameworks (fedramp_frmr, nist_csf_2, …). */
export async function getCatalogFrameworks() {
  return getJson('/catalog/frameworks', { auth: false });
}

export async function exportProjectV1(payload) {
  if (!payload?.projectId) throw new Error('projectId is required');
  const projectId = encodeURIComponent(payload.projectId);
  return getJson(
    `/integrations/v1/projects/${projectId}/export${buildQuery({
      format: payload.format || 'json',
    })}`,
  );
}

export async function exportPoamV1(payload) {
  if (!payload?.projectId) throw new Error('projectId is required');
  const projectId = encodeURIComponent(payload.projectId);
  return getJson(
    `/integrations/v1/projects/${projectId}/poam${buildQuery({
      format: payload.format || 'json',
    })}`,
  );
}

const projectConnectorsBase = (projectId) =>
  `/integrations/v1/projects/${encodeURIComponent(projectId)}/connectors`;

export async function connectorsListV1(payload) {
  if (!payload?.projectId) throw new Error('projectId is required');
  return getJson(`${projectConnectorsBase(payload.projectId)}`);
}

export async function connectorsRegistryV1(payload) {
  if (!payload?.projectId) throw new Error('projectId is required');
  return getJson(`${projectConnectorsBase(payload.projectId)}/registry`);
}

export async function connectorsStatusV1(payload) {
  if (!payload?.projectId) throw new Error('projectId is required');
  return getJson(`${projectConnectorsBase(payload.projectId)}/status/summary`);
}

export async function connectorsRunV1(payload) {
  if (!payload?.projectId) throw new Error('projectId is required');
  if (!payload?.instanceId) throw new Error('instanceId is required');
  return postJson(
    `${projectConnectorsBase(payload.projectId)}/${encodeURIComponent(payload.instanceId)}/run`,
    {},
  );
}

export async function connectorsRunsV1(payload) {
  if (!payload?.projectId) throw new Error('projectId is required');
  if (!payload?.instanceId) throw new Error('instanceId is required');
  const q = buildQuery({ limit: payload.limit });
  return getJson(
    `${projectConnectorsBase(payload.projectId)}/${encodeURIComponent(payload.instanceId)}/runs${q}`,
  );
}

export async function connectorsCreateV1(payload) {
  if (!payload?.projectId) throw new Error('projectId is required');
  if (!payload?.connectorId) throw new Error('connectorId is required');
  if (!payload?.label) throw new Error('label is required');
  return postJson(`${projectConnectorsBase(payload.projectId)}`, {
    connectorId: payload.connectorId,
    label: payload.label,
    enabled: payload.enabled !== false,
    config: payload.config || {},
  });
}

export async function opengrcSearchV1(payload = {}) {
  if (!config.integrationApiKey) {
    return {
      ok: false,
      skipped: true,
      reason: 'INTEGRATION_API_KEY not configured',
    };
  }
  const q = String(payload.q ?? payload.query ?? '').trim();
  if (q.length < 2) {
    throw new Error('q must be at least 2 characters');
  }
  return getJson(
    `/search${buildQuery({
      q,
      types: payload.types,
      projectId: payload.projectId,
      limit: payload.limit,
    })}`,
  );
}

export async function opengrcPoliciesListV1(payload = {}) {
  if (!config.integrationApiKey) {
    return {
      ok: false,
      skipped: true,
      reason: 'INTEGRATION_API_KEY not configured',
    };
  }
  return getJson(
    `/policies${buildQuery({
      projectId: payload.projectId,
      status: payload.status,
    })}`,
  );
}

export async function fedrampOscalReportV1(payload) {
  if (!payload?.projectId) throw new Error('projectId is required');
  const [ssp, poam, taxonomy] = await Promise.all([
    exportProjectV1({ projectId: payload.projectId, format: 'oscal-ssp' }),
    exportPoamV1({ projectId: payload.projectId, format: 'oscal-poam' }),
    getFrmrTaxonomy({ pathType: payload.pathType || '20x' }),
  ]);

  return {
    ok: true,
    projectId: payload.projectId,
    exports: {
      ssp,
      poam,
    },
    manifest: {
      generatedAt: new Date().toISOString(),
      projectId: payload.projectId,
      packageType: payload.pathType || '20x',
      sspUri: `${config.opengrcApiUrl}/integrations/v1/projects/${encodeURIComponent(payload.projectId)}/export?format=oscal-ssp`,
      poamUri: `${config.opengrcApiUrl}/integrations/v1/projects/${encodeURIComponent(payload.projectId)}/poam?format=oscal-poam`,
      included: ['oscal-ssp-json', 'oscal-poam-json'],
      closureSummary: payload.closureSummary || null,
      evidenceRequestIds: payload.evidenceRequestIds || [],
      autoScopeRunIds: payload.autoScopeRunIds || [],
    },
    taxonomySummary: {
      versionId: taxonomy?.versionId || null,
      processCount: Array.isArray(taxonomy?.processes) ? taxonomy.processes.length : 0,
      ksiCount: Array.isArray(taxonomy?.ksiIndicators) ? taxonomy.ksiIndicators.length : 0,
    },
  };
}

/** Integration key routes: `/integrations/v1/*` (see API IntegrationsController). */

export async function integrationDashboardStatsV1() {
  return getJson(`${integV1}/dashboard/stats`);
}

export async function integrationProjectStatsV1(projectId) {
  if (!projectId) throw new Error('projectId is required');
  return getJson(
    `${integV1}/projects/${encodeURIComponent(projectId)}/stats`,
  );
}

export async function integrationProjectConmonV1(projectId) {
  if (!projectId) throw new Error('projectId is required');
  return getJson(
    `${integV1}/projects/${encodeURIComponent(projectId)}/conmon`,
  );
}

export async function integrationExecutiveBriefingV1(projectId) {
  if (!projectId) throw new Error('projectId is required');
  return getJson(
    `${integV1}/projects/${encodeURIComponent(projectId)}/executive-briefing`,
  );
}

export async function integrationRisksListV1(projectId, query = {}) {
  if (!projectId) throw new Error('projectId is required');
  return getJson(
    `${integV1}/projects/${encodeURIComponent(projectId)}/risks${buildQuery(query)}`,
  );
}

export async function integrationRisksCreateV1(projectId, body) {
  if (!projectId) throw new Error('projectId is required');
  return postJson(
    `${integV1}/projects/${encodeURIComponent(projectId)}/risks`,
    body,
  );
}

export async function integrationRisksHeatmapV1(projectId) {
  if (!projectId) throw new Error('projectId is required');
  return getJson(
    `${integV1}/projects/${encodeURIComponent(projectId)}/risks/heatmap`,
  );
}

export async function integrationRisksUpdateV1(projectId, riskId, body) {
  if (!projectId) throw new Error('projectId is required');
  if (!riskId) throw new Error('riskId is required');
  return patchJson(
    `${integV1}/projects/${encodeURIComponent(projectId)}/risks/${encodeURIComponent(riskId)}`,
    body,
  );
}

export async function integrationPoliciesCreateV1(body) {
  return postJson(`${integV1}/policies`, body);
}

export async function integrationPoliciesUpdateV1(policyId, body) {
  if (!policyId) throw new Error('policyId is required');
  return patchJson(`${integV1}/policies/${encodeURIComponent(policyId)}`, body);
}

export async function integrationPoliciesPublishV1(policyId, body = {}) {
  if (!policyId) throw new Error('policyId is required');
  return postJson(
    `${integV1}/policies/${encodeURIComponent(policyId)}/publish`,
    body,
  );
}

export async function integrationPoliciesGenerateV1(body) {
  if (!body?.projectId) throw new Error('projectId is required');
  return postJson(`${integV1}/policies/generate`, body);
}

export async function integrationPipelineCheckV1(body) {
  if (!body?.projectId) throw new Error('projectId is required');
  return postJson(`${integV1}/pipeline/check`, body);
}

export async function integrationChecklistBulkUpdateV1(body) {
  if (!Array.isArray(body?.ids) || body.ids.length === 0) {
    throw new Error('ids[] is required');
  }
  return patchJson(`${integV1}/checklist-items/bulk`, body);
}

export async function integrationChecklistPatchItemV1(itemId, body) {
  if (!itemId) throw new Error('checklistItemId is required');
  return patchJson(
    `${integV1}/checklist-items/${encodeURIComponent(itemId)}`,
    body,
  );
}

export async function integrationAutoScopeRecommendationsV1(projectId, query = {}) {
  if (!projectId) throw new Error('projectId is required');
  return getJson(
    `${integV1}/projects/${encodeURIComponent(projectId)}/auto-scope/recommendations${buildQuery(query)}`,
  );
}

export async function integrationAutoScopeApproveV1(
  projectId,
  recommendationId,
  body = {},
) {
  if (!projectId) throw new Error('projectId is required');
  if (!recommendationId) throw new Error('recommendationId is required');
  return postJson(
    `${integV1}/projects/${encodeURIComponent(projectId)}/auto-scope/recommendations/${encodeURIComponent(recommendationId)}/approve`,
    body,
  );
}

export async function integrationCatalogCrossMapV1(query = {}) {
  return getJson(`${integV1}/catalog/cross-map${buildQuery(query)}`);
}

export async function integrationFindingsCreateV1(body) {
  if (!body?.checklistItemId) throw new Error('checklistItemId is required');
  if (!body?.title) throw new Error('title is required');
  return postJson(`${integV1}/findings`, body);
}

export async function integrationFindingsListV1(checklistItemId, query = {}) {
  if (!checklistItemId) throw new Error('checklistItemId is required');
  return getJson(
    `${integV1}/checklist-items/${encodeURIComponent(checklistItemId)}/findings${buildQuery(query)}`,
  );
}

export async function integrationAuditsCreateV1(projectId, body) {
  if (!projectId) throw new Error('projectId is required');
  return postJson(
    `${integV1}/projects/${encodeURIComponent(projectId)}/audits`,
    body,
  );
}

export async function integrationIncidentsCreateV1(projectId, body) {
  if (!projectId) throw new Error('projectId is required');
  return postJson(
    `${integV1}/projects/${encodeURIComponent(projectId)}/incidents`,
    body,
  );
}

export async function integrationVendorsListV1(projectId) {
  if (!projectId) throw new Error('projectId is required');
  return getJson(
    `${integV1}/projects/${encodeURIComponent(projectId)}/vendors`,
  );
}
