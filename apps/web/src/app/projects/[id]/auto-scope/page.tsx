'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

type Recommendation = {
  id: string;
  runId: string;
  decision: 'applicable' | 'not_applicable' | 'inherited';
  status: 'pending_review' | 'approved' | 'rejected' | 'stale';
  ruleId: string;
  confidence: number;
  rationale: string;
  matchedFacts?: string[] | null;
  explainability?: Record<string, unknown> | null;
  checklistItem: {
    id: string;
    frrRequirement?: {
      processId: string;
      reqKey: string;
      statement: string;
    };
    ksiIndicator?: {
      indicatorId: string;
      statement: string;
    };
  };
};

type RunResponse = {
  runId: string;
  generatedRecommendations: number;
  decisionCounts: Record<string, number>;
  snapshotSummary: Array<{
    sourceType: string;
    status: string;
    summary: Record<string, unknown> | null;
    error: string | null;
  }>;
};

type PreflightCheck = {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
  fix?: string;
};

type PreflightResponse = {
  ready: boolean;
  inventoryMode: 'metadata' | 'live';
  repoPath: string;
  connectors: {
    repo: boolean;
    iac: boolean;
    aws: boolean;
    azure: boolean;
    gcp: boolean;
  };
  summary: {
    total: number;
    pass: number;
    warn: number;
    fail: number;
  };
  checks: PreflightCheck[];
};

export default function AutoScopePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [repoPath, setRepoPath] = useState('');
  const [inventoryMode, setInventoryMode] = useState<'metadata' | 'live'>(
    'metadata',
  );
  const [useRepo, setUseRepo] = useState(true);
  const [useIac, setUseIac] = useState(true);
  const [useAws, setUseAws] = useState(true);
  const [useAzure, setUseAzure] = useState(true);
  const [useGcp, setUseGcp] = useState(true);
  const [awsAccountId, setAwsAccountId] = useState('');
  const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
  const [awsSessionToken, setAwsSessionToken] = useState('');
  const [azureSubscriptionId, setAzureSubscriptionId] = useState('');
  const [azureTenantId, setAzureTenantId] = useState('');
  const [azureClientId, setAzureClientId] = useState('');
  const [azureClientSecret, setAzureClientSecret] = useState('');
  const [gcpProjectId, setGcpProjectId] = useState('');
  const [gcpServiceAccountJson, setGcpServiceAccountJson] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending_review');
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'info' | 'success' | 'error'>('info');
  const [runResult, setRunResult] = useState<RunResponse | null>(null);
  const [items, setItems] = useState<Recommendation[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardError, setWizardError] = useState('');
  const [preflight, setPreflight] = useState<PreflightResponse | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);

  function applyLocalRepoPreset() {
    setInventoryMode('metadata');
    setUseRepo(true);
    setUseIac(true);
    setUseAws(false);
    setUseAzure(false);
    setUseGcp(false);
    setAwsAccountId('');
    setAwsAccessKeyId('');
    setAwsSecretAccessKey('');
    setAwsSessionToken('');
    setAzureSubscriptionId('');
    setAzureTenantId('');
    setAzureClientId('');
    setAzureClientSecret('');
    setGcpProjectId('');
    setGcpServiceAccountJson('');
    if (!repoPath) setRepoPath('/workspace');
  }

  function applyAllConnectorsPreset() {
    setUseRepo(true);
    setUseIac(true);
    setUseAws(true);
    setUseAzure(true);
    setUseGcp(true);
  }

  function goNextWizardStep() {
    setWizardError('');
    if (wizardStep === 2) {
      if (!useRepo && !useIac && !useAws && !useAzure && !useGcp) {
        setWizardError('Enable at least one connector to continue.');
        return;
      }
      if (useRepo && !repoPath) {
        setRepoPath('/workspace');
      }
    }
    if (wizardStep < 4) {
      setWizardStep((s) => s + 1);
    }
  }

  function goPrevWizardStep() {
    setWizardError('');
    if (wizardStep > 1) {
      setWizardStep((s) => s - 1);
    }
  }

  async function loadRecommendations() {
    setRefreshing(true);
    try {
      const query = new URLSearchParams();
      if (statusFilter !== 'all') query.set('status', statusFilter);
      if (decisionFilter !== 'all') query.set('decision', decisionFilter);
      const data = await api<{ items: Recommendation[] }>(
        `/projects/${id}/auto-scope/recommendations?${query.toString()}`,
      );
      setItems(data.items || []);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Failed to load recommendations');
      setMsgType('error');
      setItems([]);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadRecommendations();
  }, [statusFilter, decisionFilter]);

  useEffect(() => {
    setPreflight(null);
  }, [
    repoPath,
    inventoryMode,
    useRepo,
    useIac,
    useAws,
    useAzure,
    useGcp,
    awsAccountId,
    awsAccessKeyId,
    awsSecretAccessKey,
    awsSessionToken,
    azureSubscriptionId,
    azureTenantId,
    azureClientId,
    azureClientSecret,
    gcpProjectId,
    gcpServiceAccountJson,
  ]);

  const summary = useMemo(() => {
    return {
      total: items.length,
      pending: items.filter((i) => i.status === 'pending_review').length,
      approved: items.filter((i) => i.status === 'approved').length,
      rejected: items.filter((i) => i.status === 'rejected').length,
      stale: items.filter((i) => i.status === 'stale').length,
    };
  }, [items]);

  function toggleSelected(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function runAutoScope() {
    setLoading(true);
    setMsg('');
    setRunResult(null);
    try {
      const body = {
        repoPath: repoPath || undefined,
        inventoryMode,
        connectors: {
          repo: useRepo,
          iac: useIac,
          aws: useAws,
          azure: useAzure,
          gcp: useGcp,
        },
        cloud: {
          aws: {
            accountId: awsAccountId || undefined,
            accessKeyId: awsAccessKeyId || undefined,
            secretAccessKey: awsSecretAccessKey || undefined,
            sessionToken: awsSessionToken || undefined,
          },
          azure: {
            subscriptionId: azureSubscriptionId || undefined,
            tenantId: azureTenantId || undefined,
            clientId: azureClientId || undefined,
            clientSecret: azureClientSecret || undefined,
          },
          gcp: {
            projectId: gcpProjectId || undefined,
            serviceAccountJson: gcpServiceAccountJson || undefined,
          },
        },
      };
      const result = await api<RunResponse>(`/projects/${id}/auto-scope/run`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setRunResult(result);
      setMsg(`Run complete: ${result.generatedRecommendations} recommendations generated`);
      setMsgType('success');
      setStatusFilter('pending_review');
      await loadRecommendations();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Run failed');
      setMsgType('error');
    } finally {
      setLoading(false);
    }
  }

  async function runPreflight() {
    setPreflightLoading(true);
    setWizardError('');
    try {
      const body = {
        repoPath: repoPath || undefined,
        inventoryMode,
        connectors: {
          repo: useRepo,
          iac: useIac,
          aws: useAws,
          azure: useAzure,
          gcp: useGcp,
        },
        cloud: {
          aws: {
            accountId: awsAccountId || undefined,
            accessKeyId: awsAccessKeyId || undefined,
            secretAccessKey: awsSecretAccessKey || undefined,
            sessionToken: awsSessionToken || undefined,
          },
          azure: {
            subscriptionId: azureSubscriptionId || undefined,
            tenantId: azureTenantId || undefined,
            clientId: azureClientId || undefined,
            clientSecret: azureClientSecret || undefined,
          },
          gcp: {
            projectId: gcpProjectId || undefined,
            serviceAccountJson: gcpServiceAccountJson || undefined,
          },
        },
      };
      const result = await api<PreflightResponse>(
        `/projects/${id}/auto-scope/preflight`,
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      );
      setPreflight(result);
      if (result.ready) {
        setMsg('Preflight passed. Environment is ready.');
        setMsgType('success');
      } else {
        setMsg('Preflight found blockers. Follow fix guidance below.');
        setMsgType('error');
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Preflight failed');
      setMsgType('error');
    } finally {
      setPreflightLoading(false);
    }
  }

  async function approve(id: string) {
    try {
      await api(`/projects/${params.id}/auto-scope/recommendations/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setMsg('Recommendation approved');
      setMsgType('success');
      await loadRecommendations();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Approve failed');
      setMsgType('error');
    }
  }

  async function reject(id: string) {
    try {
      await api(`/projects/${params.id}/auto-scope/recommendations/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setMsg('Recommendation rejected');
      setMsgType('success');
      await loadRecommendations();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Reject failed');
      setMsgType('error');
    }
  }

  async function bulkApprove() {
    if (!selected.length) return;
    try {
      await api(`/projects/${params.id}/auto-scope/recommendations/bulk-approve`, {
        method: 'POST',
        body: JSON.stringify({ recommendationIds: selected }),
      });
      setSelected([]);
      setMsg('Selected recommendations approved');
      setMsgType('success');
      await loadRecommendations();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Bulk approve failed');
      setMsgType('error');
    }
  }

  return (
    <div className="animate-in">
      <div style={{ marginBottom: '1rem' }}>
        <Link href={`/projects/${id}`} className="btn-ghost" style={{ textDecoration: 'none', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Projects
          </span>
        </Link>
      </div>

      <div className="page-header">
        <div>
          <h1>Auto-Scoping</h1>
          <p className="text-sm text-muted" style={{ marginTop: '0.25rem' }}>
            Multi-source analysis with review-gated applicability recommendations.
          </p>
        </div>
      </div>

      <div className="tab-bar">
        <Link href={`/projects/${id}`} className="tab-item" style={{ textDecoration: 'none' }}>Checklist</Link>
        <Link href={`/projects/${id}/auto-scope`} className="tab-item active" style={{ textDecoration: 'none' }}>Auto-Scope</Link>
        <Link href={`/projects/${id}/poam`} className="tab-item" style={{ textDecoration: 'none' }}>POA&amp;M</Link>
      </div>

      {msg && <div className={`alert alert-${msgType}`}>{msg}</div>}

      <div className="card mt-2">
        <div className="card-header">
          <h3 style={{ marginBottom: 0 }}>Auto-Scoping Setup Wizard</h3>
          <span className="badge badge-blue">Step {wizardStep} of 4</span>
        </div>
        <div className="gap-row" style={{ marginBottom: '0.75rem' }}>
          <span className={`badge ${wizardStep >= 1 ? 'badge-blue' : ''}`}>Mode</span>
          <span className={`badge ${wizardStep >= 2 ? 'badge-blue' : ''}`}>Connectors</span>
          <span className={`badge ${wizardStep >= 3 ? 'badge-blue' : ''}`}>Cloud Details</span>
          <span className={`badge ${wizardStep >= 4 ? 'badge-blue' : ''}`}>Review & Run</span>
        </div>

        {wizardStep === 1 && (
          <div>
            <p className="text-sm text-muted mb-2">
              Choose how cloud discovery should run. Start with metadata for the easiest first run.
            </p>
            <div style={{ maxWidth: 380 }}>
              <label className="form-label">Cloud Inventory Mode</label>
              <select
                className="form-select"
                style={{ maxWidth: '100%' }}
                value={inventoryMode}
                onChange={(e) =>
                  setInventoryMode(e.target.value as 'metadata' | 'live')
                }
              >
                <option value="metadata">Metadata only (recommended)</option>
                <option value="live">Live cloud inventory (SDK-based)</option>
              </select>
            </div>
            {inventoryMode === 'live' ? (
              <div className="alert alert-info mt-2">
                Live mode uses cloud SDKs in the API runtime and requires valid cloud credentials.
              </div>
            ) : (
              <div className="alert alert-success mt-2">
                Good choice for first-time setup. You can switch to live mode later.
              </div>
            )}
          </div>
        )}

        {wizardStep === 2 && (
          <div>
            <p className="text-sm text-muted mb-2">
              Pick data sources. For most teams, start with <strong style={{ color: 'var(--text)' }}>REPO + IAC</strong>.
            </p>
            <div className="btn-group mb-2">
              <button type="button" className="btn btn-primary" onClick={applyLocalRepoPreset}>
                Use Recommended Starter
              </button>
              <button type="button" className="btn btn-secondary" onClick={applyAllConnectorsPreset}>
                Enable All Connectors
              </button>
            </div>
            <div className="gap-row mt-1">
              <label className="badge" style={{ cursor: 'pointer', padding: '0.3rem 0.6rem' }}>
                <input
                  type="checkbox"
                  checked={useRepo}
                  onChange={(e) => setUseRepo(e.target.checked)}
                  style={{ marginRight: '0.4rem' }}
                />
                REPO
              </label>
              <label className="badge" style={{ cursor: 'pointer', padding: '0.3rem 0.6rem' }}>
                <input
                  type="checkbox"
                  checked={useIac}
                  onChange={(e) => setUseIac(e.target.checked)}
                  style={{ marginRight: '0.4rem' }}
                />
                IAC
              </label>
              <label className="badge" style={{ cursor: 'pointer', padding: '0.3rem 0.6rem' }}>
                <input
                  type="checkbox"
                  checked={useAws}
                  onChange={(e) => setUseAws(e.target.checked)}
                  style={{ marginRight: '0.4rem' }}
                />
                AWS
              </label>
              <label className="badge" style={{ cursor: 'pointer', padding: '0.3rem 0.6rem' }}>
                <input
                  type="checkbox"
                  checked={useAzure}
                  onChange={(e) => setUseAzure(e.target.checked)}
                  style={{ marginRight: '0.4rem' }}
                />
                AZURE
              </label>
              <label className="badge" style={{ cursor: 'pointer', padding: '0.3rem 0.6rem' }}>
                <input
                  type="checkbox"
                  checked={useGcp}
                  onChange={(e) => setUseGcp(e.target.checked)}
                  style={{ marginRight: '0.4rem' }}
                />
                GCP
              </label>
            </div>
            {useRepo && (
              <div style={{ marginTop: '0.75rem', maxWidth: 500 }}>
                <label className="form-label">Repository Path</label>
                <input
                  className="form-input"
                  style={{ maxWidth: '100%' }}
                  value={repoPath}
                  onChange={(e) => setRepoPath(e.target.value)}
                  placeholder="/workspace (Docker default)"
                />
                <div className="text-sm text-dim mt-1">
                  If you are unsure, keep <code>/workspace</code>.
                </div>
              </div>
            )}
          </div>
        )}

        {wizardStep === 3 && (
          <div>
            <p className="text-sm text-muted mb-2">
              Add cloud identifiers only for connectors you enabled. You can leave others blank.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {useAws && (
                <div>
                  <label className="form-label">AWS Account Id</label>
                  <input
                    className="form-input"
                    style={{ maxWidth: '100%' }}
                    value={awsAccountId}
                    onChange={(e) => setAwsAccountId(e.target.value)}
                    placeholder="123456789012"
                  />
                  <div className="text-sm text-dim mt-1">
                    Optional. Or provide access key credentials below.
                  </div>
                  <label className="form-label mt-1">AWS Access Key Id (optional)</label>
                  <input
                    className="form-input"
                    style={{ maxWidth: '100%' }}
                    value={awsAccessKeyId}
                    onChange={(e) => setAwsAccessKeyId(e.target.value)}
                    placeholder="AKIA..."
                  />
                  <label className="form-label mt-1">AWS Secret Access Key (optional)</label>
                  <input
                    className="form-input"
                    type="password"
                    style={{ maxWidth: '100%' }}
                    value={awsSecretAccessKey}
                    onChange={(e) => setAwsSecretAccessKey(e.target.value)}
                    placeholder="********"
                  />
                  <label className="form-label mt-1">AWS Session Token (optional)</label>
                  <input
                    className="form-input"
                    style={{ maxWidth: '100%' }}
                    value={awsSessionToken}
                    onChange={(e) => setAwsSessionToken(e.target.value)}
                    placeholder="temporary token"
                  />
                </div>
              )}
              {useAzure && (
                <>
                  <div>
                    <label className="form-label">Azure Subscription Id</label>
                    <input
                      className="form-input"
                      style={{ maxWidth: '100%' }}
                      value={azureSubscriptionId}
                      onChange={(e) => setAzureSubscriptionId(e.target.value)}
                      placeholder="subscription id"
                    />
                  </div>
                  <div>
                    <label className="form-label">Azure Tenant Id</label>
                    <input
                      className="form-input"
                      style={{ maxWidth: '100%' }}
                      value={azureTenantId}
                      onChange={(e) => setAzureTenantId(e.target.value)}
                      placeholder="tenant id"
                    />
                  </div>
                  <div>
                    <label className="form-label">Azure Client Id (optional)</label>
                    <input
                      className="form-input"
                      style={{ maxWidth: '100%' }}
                      value={azureClientId}
                      onChange={(e) => setAzureClientId(e.target.value)}
                      placeholder="application (client) id"
                    />
                  </div>
                  <div>
                    <label className="form-label">Azure Client Secret (optional)</label>
                    <input
                      className="form-input"
                      type="password"
                      style={{ maxWidth: '100%' }}
                      value={azureClientSecret}
                      onChange={(e) => setAzureClientSecret(e.target.value)}
                      placeholder="********"
                    />
                  </div>
                </>
              )}
              {useGcp && (
                <div>
                  <label className="form-label">GCP Project Id</label>
                  <input
                    className="form-input"
                    style={{ maxWidth: '100%' }}
                    value={gcpProjectId}
                    onChange={(e) => setGcpProjectId(e.target.value)}
                    placeholder="project-id"
                  />
                  <label className="form-label mt-1">GCP Service Account JSON (optional)</label>
                  <textarea
                    className="form-input"
                    style={{ maxWidth: '100%', minHeight: '110px' }}
                    value={gcpServiceAccountJson}
                    onChange={(e) => setGcpServiceAccountJson(e.target.value)}
                    placeholder='{"type":"service_account", ...}'
                  />
                </div>
              )}
            </div>
            {!useAws && !useAzure && !useGcp && (
              <div className="alert alert-info mt-2">
                No cloud connectors selected — this run will use repository and IaC signals only.
              </div>
            )}
          </div>
        )}

        {wizardStep === 4 && (
          <div>
            <p className="text-sm text-muted mb-2">
              Review your setup, run preflight, then run auto-scoping.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.6rem' }}>
              <div className="stat-card">
                <div className="stat-label">Mode</div>
                <div className="stat-value" style={{ fontSize: '1rem' }}>
                  {inventoryMode === 'live' ? 'Live' : 'Metadata'}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Connectors</div>
                <div className="text-sm text-muted">
                  {[useRepo && 'REPO', useIac && 'IAC', useAws && 'AWS', useAzure && 'AZURE', useGcp && 'GCP']
                    .filter(Boolean)
                    .join(', ') || 'None'}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Repo Path</div>
                <div className="text-sm text-muted">{repoPath || '(default workspace)'}</div>
              </div>
            </div>
            <div className="btn-group mt-2">
              <button
                className="btn btn-secondary"
                onClick={runPreflight}
                disabled={preflightLoading}
              >
                {preflightLoading ? 'Checking...' : 'Run Cloud Access Preflight'}
              </button>
              <button
                className="btn btn-primary"
                onClick={runAutoScope}
                disabled={loading || (inventoryMode === 'live' && !preflight?.ready)}
              >
                {loading ? 'Running...' : 'Run Auto-Scoping Now'}
              </button>
            </div>
            {inventoryMode === 'live' && (
              <div className="text-sm text-dim mt-1">
                Live runs should pass preflight first so cloud access and credentials are verified.
              </div>
            )}

            {preflight && (
              <div className="card mt-2" style={{ marginBottom: 0 }}>
                <div className="card-header">
                  <h3 style={{ marginBottom: 0 }}>Preflight Results</h3>
                  <span className={`badge ${preflight.ready ? 'badge-green' : 'badge-red'}`}>
                    {preflight.ready ? 'Ready' : 'Needs fixes'}
                  </span>
                </div>
                <div className="gap-row mb-1">
                  <span className="badge badge-green">Pass: {preflight.summary.pass}</span>
                  <span className="badge badge-yellow">Warn: {preflight.summary.warn}</span>
                  <span className="badge badge-red">Fail: {preflight.summary.fail}</span>
                </div>
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  {preflight.checks.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.55rem 0.65rem',
                        background: 'var(--bg)',
                      }}
                    >
                      <div className="gap-row" style={{ justifyContent: 'space-between' }}>
                        <strong style={{ fontSize: '0.8rem' }}>{c.label}</strong>
                        <span
                          className={`badge ${
                            c.status === 'pass'
                              ? 'badge-green'
                              : c.status === 'warn'
                              ? 'badge-yellow'
                              : 'badge-red'
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>
                      <div className="text-sm text-muted mt-1">{c.detail}</div>
                      {c.fix && <div className="text-sm text-dim mt-1">Fix: {c.fix}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {wizardError && <div className="alert alert-error mt-2">{wizardError}</div>}

        <div className="btn-group mt-2">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={goPrevWizardStep}
            disabled={wizardStep === 1}
          >
            Back
          </button>
          {wizardStep < 4 ? (
            <button type="button" className="btn btn-primary" onClick={goNextWizardStep}>
              Next
            </button>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={() => setWizardStep(1)}>
              Start Over
            </button>
          )}
        </div>
      </div>

      {runResult && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ marginBottom: 0 }}>Latest Run Summary</h3>
            <span className="badge">{runResult.runId.slice(0, 8)}</span>
          </div>
          <div className="gap-row">
            <span className="badge badge-blue">Applicable: {runResult.decisionCounts?.applicable || 0}</span>
            <span className="badge badge-yellow">Inherited: {runResult.decisionCounts?.inherited || 0}</span>
            <span className="badge badge-red">Not Applicable: {runResult.decisionCounts?.not_applicable || 0}</span>
          </div>
          <div className="mt-2">
            {runResult.snapshotSummary?.map((s) => (
              <div key={s.sourceType} className="text-sm text-muted" style={{ marginBottom: '0.25rem' }}>
                <strong style={{ color: 'var(--text)' }}>{s.sourceType.toUpperCase()}</strong> - {s.status}
                {s.error ? ` (${s.error})` : ''}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.6rem' }}>
        <div className="gap-row">
          <h3 style={{ marginBottom: 0 }}>Recommendations</h3>
          <span className="badge">{summary.total} total</span>
          <span className="badge badge-blue">{summary.pending} pending</span>
          <span className="badge badge-green">{summary.approved} approved</span>
          <span className="badge badge-red">{summary.rejected} rejected</span>
        </div>
        <div className="gap-row">
          <select className="form-select" style={{ maxWidth: 170 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="pending_review">Pending review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="stale">Stale</option>
          </select>
          <select className="form-select" style={{ maxWidth: 180 }} value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value)}>
            <option value="all">All decisions</option>
            <option value="applicable">Applicable</option>
            <option value="inherited">Inherited</option>
            <option value="not_applicable">Not applicable</option>
          </select>
          <button className="btn btn-secondary" onClick={loadRecommendations} disabled={refreshing}>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="btn btn-primary" onClick={bulkApprove} disabled={!selected.length}>
            Bulk Approve ({selected.length})
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <p>No recommendations available. Run auto-scoping to generate a review queue.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {items.map((item) => {
            const ref = item.checklistItem?.frrRequirement
              ? `${item.checklistItem.frrRequirement.processId}/${item.checklistItem.frrRequirement.reqKey}`
              : item.checklistItem?.ksiIndicator?.indicatorId || item.checklistItem?.id;
            const text =
              item.checklistItem?.frrRequirement?.statement ||
              item.checklistItem?.ksiIndicator?.statement ||
              '';
            return (
              <div key={item.id} className="card" style={{ marginBottom: 0 }}>
                <div className="card-header">
                  <div className="gap-row">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={() => toggleSelected(item.id)}
                    />
                    <strong style={{ fontSize: '0.86rem' }}>{ref}</strong>
                    <span className={`badge ${
                      item.decision === 'applicable'
                        ? 'badge-green'
                        : item.decision === 'inherited'
                        ? 'badge-yellow'
                        : 'badge-red'
                    }`}>
                      {item.decision}
                    </span>
                    <span className="badge">{item.status}</span>
                    <span className="badge">confidence {Math.round(item.confidence * 100)}%</span>
                  </div>
                  <div className="gap-row">
                    <button
                      className="btn btn-primary"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.74rem' }}
                      disabled={item.status !== 'pending_review'}
                      onClick={() => approve(item.id)}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.74rem' }}
                      disabled={item.status !== 'pending_review'}
                      onClick={() => reject(item.id)}
                    >
                      Reject
                    </button>
                  </div>
                </div>
                <div className="text-sm text-muted" style={{ marginBottom: '0.4rem' }}>{text}</div>
                <div className="text-sm">
                  <strong style={{ color: 'var(--text)' }}>Rule:</strong>{' '}
                  <span className="text-muted">{item.ruleId}</span>
                </div>
                <div className="text-sm mt-1">
                  <strong style={{ color: 'var(--text)' }}>Rationale:</strong>{' '}
                  <span className="text-muted">{item.rationale}</span>
                </div>
                {item.matchedFacts && item.matchedFacts.length > 0 && (
                  <div className="mt-1">
                    {item.matchedFacts.map((f) => (
                      <span key={f} className="badge" style={{ marginRight: '0.3rem' }}>
                        {f}
                      </span>
                    ))}
                  </div>
                )}
                {item.explainability && (
                  <details className="mt-1">
                    <summary className="text-sm text-muted" style={{ cursor: 'pointer' }}>
                      Explainability details
                    </summary>
                    <pre
                      style={{
                        marginTop: '0.45rem',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.6rem',
                        fontSize: '0.74rem',
                        overflowX: 'auto',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {JSON.stringify(item.explainability, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
