'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  RotateCw,
  Check,
  X,
  AlertTriangle,
  Zap,
  Cloud,
  Server,
  GitBranch,
  Globe,
} from 'lucide-react';

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

const WIZARD_STEPS = ['Mode', 'Connectors', 'Cloud Details', 'Review & Run'] as const;

const CONNECTOR_OPTIONS = [
  { key: 'repo', label: 'REPO', icon: GitBranch },
  { key: 'iac', label: 'IAC', icon: Server },
  { key: 'aws', label: 'AWS', icon: Cloud },
  { key: 'azure', label: 'AZURE', icon: Globe },
  { key: 'gcp', label: 'GCP', icon: Cloud },
] as const;

function preflightBadgeClass(status: 'pass' | 'warn' | 'fail') {
  if (status === 'pass') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  if (status === 'warn') return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400';
  return 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400';
}

function decisionBadgeVariant(d: string) {
  if (d === 'applicable') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  if (d === 'inherited') return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400';
  return 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400';
}

export default function AutoScopePage({ params }: { params: { id: string } }) {
  const { id } = params;

  const [repoPath, setRepoPath] = useState('');
  const [inventoryMode, setInventoryMode] = useState<'metadata' | 'live'>('metadata');
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
  const [initialLoad, setInitialLoad] = useState(true);
  const [runResult, setRunResult] = useState<RunResponse | null>(null);
  const [items, setItems] = useState<Recommendation[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardError, setWizardError] = useState('');
  const [preflight, setPreflight] = useState<PreflightResponse | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);

  const connectorMap: Record<string, boolean> = {
    repo: useRepo,
    iac: useIac,
    aws: useAws,
    azure: useAzure,
    gcp: useGcp,
  };

  const connectorSetters: Record<string, (v: boolean) => void> = {
    repo: setUseRepo,
    iac: setUseIac,
    aws: setUseAws,
    azure: setUseAzure,
    gcp: setUseGcp,
  };

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
      query.set('limit', '200');
      if (statusFilter !== 'all') query.set('status', statusFilter);
      if (decisionFilter !== 'all') query.set('decision', decisionFilter);
      const data = await api<{
        items: Recommendation[];
        total?: number;
        page?: number;
        hasMore?: boolean;
      }>(`/projects/${id}/auto-scope/recommendations?${query.toString()}`);
      setItems(data.items || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load recommendations');
      setItems([]);
    } finally {
      setRefreshing(false);
      setInitialLoad(false);
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

  function toggleSelected(recId: string) {
    setSelected((prev) =>
      prev.includes(recId) ? prev.filter((x) => x !== recId) : [...prev, recId],
    );
  }

  function buildRequestBody() {
    return {
      repoPath: repoPath || undefined,
      inventoryMode,
      connectors: { repo: useRepo, iac: useIac, aws: useAws, azure: useAzure, gcp: useGcp },
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
  }

  async function runAutoScope() {
    setLoading(true);
    setRunResult(null);
    try {
      const result = await api<RunResponse>(`/projects/${id}/auto-scope/run`, {
        method: 'POST',
        body: JSON.stringify(buildRequestBody()),
      });
      setRunResult(result);
      toast.success(`Run complete: ${result.generatedRecommendations} recommendations generated`);
      setStatusFilter('pending_review');
      await loadRecommendations();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Run failed');
    } finally {
      setLoading(false);
    }
  }

  async function runPreflight() {
    setPreflightLoading(true);
    setWizardError('');
    try {
      const result = await api<PreflightResponse>(
        `/projects/${id}/auto-scope/preflight`,
        { method: 'POST', body: JSON.stringify(buildRequestBody()) },
      );
      setPreflight(result);
      if (result.ready) {
        toast.success('Preflight passed. Environment is ready.');
      } else {
        toast.error('Preflight found blockers. Follow fix guidance below.');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Preflight failed');
    } finally {
      setPreflightLoading(false);
    }
  }

  async function approve(recId: string) {
    try {
      await api(`/projects/${id}/auto-scope/recommendations/${recId}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      toast.success('Recommendation approved');
      await loadRecommendations();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Approve failed');
    }
  }

  async function reject(recId: string) {
    try {
      await api(`/projects/${id}/auto-scope/recommendations/${recId}/reject`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      toast.success('Recommendation rejected');
      await loadRecommendations();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Reject failed');
    }
  }

  async function bulkApprove() {
    if (!selected.length) return;
    try {
      await api(`/projects/${id}/auto-scope/recommendations/bulk-approve`, {
        method: 'POST',
        body: JSON.stringify({ recommendationIds: selected }),
      });
      setSelected([]);
      toast.success('Selected recommendations approved');
      await loadRecommendations();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Bulk approve failed');
    }
  }

  const activeConnectors = [useRepo && 'REPO', useIac && 'IAC', useAws && 'AWS', useAzure && 'AZURE', useGcp && 'GCP']
    .filter(Boolean)
    .join(', ');

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      {/* Back link */}
      <Link
        href={`/projects/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="size-4" />
        Projects
      </Link>

      {/* Page header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Auto-Scoping</h1>
        <p className="text-sm text-muted-foreground">
          Multi-source analysis with review-gated applicability recommendations.
        </p>
      </div>

      {/* Tab bar */}
      <Tabs value="auto-scope">
        <TabsList>
          <TabsTrigger value="checklist" asChild>
            <Link href={`/projects/${id}`}>Checklist</Link>
          </TabsTrigger>
          <TabsTrigger value="auto-scope" asChild>
            <Link href={`/projects/${id}/auto-scope`}>Auto-Scope</Link>
          </TabsTrigger>
          <TabsTrigger value="poam" asChild>
            <Link href={`/projects/${id}/poam`}>POA&M</Link>
          </TabsTrigger>
          <TabsTrigger value="risk" asChild>
            <Link href={`/projects/${id}/risk`}>Risk</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Wizard */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Auto-Scoping Setup Wizard</CardTitle>
            <Badge>Step {wizardStep} of 4</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step indicators */}
          <div className="flex items-center gap-2">
            {WIZARD_STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                {i > 0 && <Separator className="w-4" />}
                <button
                  type="button"
                  onClick={() => {
                    if (i + 1 <= wizardStep) setWizardStep(i + 1);
                  }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-[4px] px-2 py-0.5 text-xs font-medium transition-colors',
                    wizardStep >= i + 1
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                    i + 1 <= wizardStep && 'cursor-pointer hover:opacity-90',
                    i + 1 > wizardStep && 'cursor-default',
                  )}
                >
                  <span className="flex size-4 items-center justify-center rounded-[4px] bg-background/20 text-[10px] font-bold">
                    {i + 1}
                  </span>
                  {label}
                </button>
              </div>
            ))}
          </div>

          <Separator />

          {/* Step 1: Mode */}
          {wizardStep === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Choose how cloud discovery should run. Start with metadata for the easiest first run.
              </p>
              <div className="max-w-sm space-y-2">
                <Label htmlFor="inventoryMode">Cloud Inventory Mode</Label>
                <select
                  id="inventoryMode"
                  className="h-8 w-full rounded-[4px] border border-input bg-background px-3 text-sm text-foreground"
                  value={inventoryMode}
                  onChange={(e) => setInventoryMode(e.target.value as 'metadata' | 'live')}
                >
                  <option value="metadata">Metadata only (recommended)</option>
                  <option value="live">Live cloud inventory (SDK-based)</option>
                </select>
              </div>
              {inventoryMode === 'live' ? (
                <Alert>
                  <AlertTriangle className="size-4" />
                  <AlertDescription>
                    Live mode uses cloud SDKs in the API runtime and requires valid cloud credentials.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <Check className="size-4" />
                  <AlertDescription>
                    Good choice for first-time setup. You can switch to live mode later.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Step 2: Connectors */}
          {wizardStep === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Pick data sources. For most teams, start with <strong className="text-foreground">REPO + IAC</strong>.
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={applyLocalRepoPreset}>
                  <Zap className="size-4" />
                  Use Recommended Starter
                </Button>
                <Button variant="outline" size="sm" onClick={applyAllConnectorsPreset}>
                  Enable All Connectors
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {CONNECTOR_OPTIONS.map(({ key, label, icon: Icon }) => (
                  <label
                    key={key}
                    className={cn(
                      'flex items-center gap-2 rounded-[4px] border px-3 py-2 text-sm cursor-pointer transition-colors',
                      connectorMap[key]
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-input hover:bg-muted/50',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={connectorMap[key]}
                      onChange={(e) => connectorSetters[key](e.target.checked)}
                      className="size-4 rounded border-input accent-primary"
                    />
                    <Icon className="size-3.5 text-muted-foreground" />
                    {label}
                  </label>
                ))}
              </div>
              {useRepo && (
                <div className="max-w-md space-y-2">
                  <Label htmlFor="repoPath">Repository Path</Label>
                  <Input
                    id="repoPath"
                    value={repoPath}
                    onChange={(e) => setRepoPath(e.target.value)}
                    placeholder="/workspace (Docker default)"
                  />
                  <p className="text-xs text-muted-foreground">
                    If you are unsure, keep <code className="rounded bg-muted px-1 py-0.5">/workspace</code>.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Cloud Details */}
          {wizardStep === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Add cloud identifiers only for connectors you enabled. You can leave others blank.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {useAws && (
                  <div className="space-y-3 rounded-[4px] border border-input p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Cloud className="size-4 text-muted-foreground" />
                      AWS
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="awsAccountId">Account ID</Label>
                      <Input
                        id="awsAccountId"
                        value={awsAccountId}
                        onChange={(e) => setAwsAccountId(e.target.value)}
                        placeholder="123456789012"
                      />
                      <p className="text-xs text-muted-foreground">Optional. Or provide access key credentials below.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="awsAccessKeyId">Access Key ID (optional)</Label>
                      <Input
                        id="awsAccessKeyId"
                        value={awsAccessKeyId}
                        onChange={(e) => setAwsAccessKeyId(e.target.value)}
                        placeholder="AKIA..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="awsSecretAccessKey">Secret Access Key (optional)</Label>
                      <Input
                        id="awsSecretAccessKey"
                        type="password"
                        value={awsSecretAccessKey}
                        onChange={(e) => setAwsSecretAccessKey(e.target.value)}
                        placeholder="********"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="awsSessionToken">Session Token (optional)</Label>
                      <Input
                        id="awsSessionToken"
                        value={awsSessionToken}
                        onChange={(e) => setAwsSessionToken(e.target.value)}
                        placeholder="temporary token"
                      />
                    </div>
                  </div>
                )}
                {useAzure && (
                  <div className="space-y-3 rounded-[4px] border border-input p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Globe className="size-4 text-muted-foreground" />
                      Azure
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="azureSubscriptionId">Subscription ID</Label>
                      <Input
                        id="azureSubscriptionId"
                        value={azureSubscriptionId}
                        onChange={(e) => setAzureSubscriptionId(e.target.value)}
                        placeholder="subscription id"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="azureTenantId">Tenant ID</Label>
                      <Input
                        id="azureTenantId"
                        value={azureTenantId}
                        onChange={(e) => setAzureTenantId(e.target.value)}
                        placeholder="tenant id"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="azureClientId">Client ID (optional)</Label>
                      <Input
                        id="azureClientId"
                        value={azureClientId}
                        onChange={(e) => setAzureClientId(e.target.value)}
                        placeholder="application (client) id"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="azureClientSecret">Client Secret (optional)</Label>
                      <Input
                        id="azureClientSecret"
                        type="password"
                        value={azureClientSecret}
                        onChange={(e) => setAzureClientSecret(e.target.value)}
                        placeholder="********"
                      />
                    </div>
                  </div>
                )}
                {useGcp && (
                  <div className="space-y-3 rounded-[4px] border border-input p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Cloud className="size-4 text-muted-foreground" />
                      GCP
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gcpProjectId">Project ID</Label>
                      <Input
                        id="gcpProjectId"
                        value={gcpProjectId}
                        onChange={(e) => setGcpProjectId(e.target.value)}
                        placeholder="project-id"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gcpSaJson">Service Account JSON (optional)</Label>
                      <textarea
                        id="gcpSaJson"
                        className="min-h-[110px] w-full rounded-[4px] border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={gcpServiceAccountJson}
                        onChange={(e) => setGcpServiceAccountJson(e.target.value)}
                        placeholder='{"type":"service_account", ...}'
                      />
                    </div>
                  </div>
                )}
              </div>
              {!useAws && !useAzure && !useGcp && (
                <Alert>
                  <AlertTriangle className="size-4" />
                  <AlertDescription>
                    No cloud connectors selected — this run will use repository and IaC signals only.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Step 4: Review & Run */}
          {wizardStep === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Review your setup, run preflight, then run auto-scoping.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Card className="py-4">
                  <CardContent className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Mode</p>
                    <p className="text-sm font-semibold">{inventoryMode === 'live' ? 'Live' : 'Metadata'}</p>
                  </CardContent>
                </Card>
                <Card className="py-4">
                  <CardContent className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Connectors</p>
                    <p className="text-sm text-muted-foreground">{activeConnectors || 'None'}</p>
                  </CardContent>
                </Card>
                <Card className="py-4">
                  <CardContent className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Repo Path</p>
                    <p className="text-sm text-muted-foreground">{repoPath || '(default workspace)'}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={runPreflight} disabled={preflightLoading}>
                  {preflightLoading ? (
                    <>
                      <RotateCw className="size-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="size-4" />
                      Run Cloud Access Preflight
                    </>
                  )}
                </Button>
                <Button
                  onClick={runAutoScope}
                  disabled={loading || (inventoryMode === 'live' && !preflight?.ready)}
                >
                  {loading ? (
                    <>
                      <RotateCw className="size-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="size-4" />
                      Run Auto-Scoping Now
                    </>
                  )}
                </Button>
              </div>

              {inventoryMode === 'live' && (
                <p className="text-xs text-muted-foreground">
                  Live runs should pass preflight first so cloud access and credentials are verified.
                </p>
              )}

              {/* Preflight Results */}
              {preflight && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Preflight Results</CardTitle>
                      <Badge
                        className={cn(
                          'border',
                          preflight.ready
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400',
                        )}
                      >
                        {preflight.ready ? 'Ready' : 'Needs fixes'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                        Pass: {preflight.summary.pass}
                      </Badge>
                      <Badge className="border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                        Warn: {preflight.summary.warn}
                      </Badge>
                      <Badge className="border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400">
                        Fail: {preflight.summary.fail}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {preflight.checks.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-[4px] border border-border bg-muted/30 px-3 py-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{c.label}</span>
                            <Badge className={cn('border', preflightBadgeClass(c.status))}>
                              {c.status}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{c.detail}</p>
                          {c.fix && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">Fix:</span> {c.fix}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Wizard error */}
          {wizardError && (
            <Alert variant="destructive">
              <X className="size-4" />
              <AlertDescription>{wizardError}</AlertDescription>
            </Alert>
          )}

          {/* Wizard navigation */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              onClick={goPrevWizardStep}
              disabled={wizardStep === 1}
            >
              <ChevronLeft className="size-4" />
              Back
            </Button>
            {wizardStep < 4 ? (
              <Button onClick={goNextWizardStep}>
                Next
                <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setWizardStep(1)}>
                <RotateCw className="size-4" />
                Start Over
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Run result summary */}
      {runResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Latest Run Summary</CardTitle>
              <Badge variant="secondary">{runResult.runId.slice(0, 8)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                Applicable: {runResult.decisionCounts?.applicable || 0}
              </Badge>
              <Badge className="border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                Inherited: {runResult.decisionCounts?.inherited || 0}
              </Badge>
              <Badge className="border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400">
                Not Applicable: {runResult.decisionCounts?.not_applicable || 0}
              </Badge>
            </div>
            {runResult.snapshotSummary?.map((s) => (
              <p key={s.sourceType} className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{s.sourceType.toUpperCase()}</span>{' '}
                &ndash; {s.status}
                {s.error ? ` (${s.error})` : ''}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recommendations header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Recommendations</h2>
          <Badge variant="secondary">{summary.total} total</Badge>
          <Badge>{summary.pending} pending</Badge>
          <Badge className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            {summary.approved} approved
          </Badge>
          <Badge className="border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400">
            {summary.rejected} rejected
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-8 rounded-[4px] border border-input bg-background px-3 text-sm text-foreground"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="pending_review">Pending review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="stale">Stale</option>
          </select>
          <select
            className="h-8 rounded-[4px] border border-input bg-background px-3 text-sm text-foreground"
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value)}
            aria-label="Filter by decision"
          >
            <option value="all">All decisions</option>
            <option value="applicable">Applicable</option>
            <option value="inherited">Inherited</option>
            <option value="not_applicable">Not applicable</option>
          </select>
          <Button variant="outline" size="sm" onClick={loadRecommendations} disabled={refreshing}>
            <RotateCw className={cn('size-4', refreshing && 'animate-spin')} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button size="sm" onClick={bulkApprove} disabled={!selected.length}>
            <Check className="size-4" />
            Bulk Approve ({selected.length})
          </Button>
        </div>
      </div>

      {/* Loading skeleton */}
      {initialLoad && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 py-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-5 w-20 rounded-[4px]" />
                  <Skeleton className="h-5 w-16 rounded-[4px]" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!initialLoad && items.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Zap className="mb-3 size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No recommendations available. Run auto-scoping to generate a review queue.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recommendations list */}
      {!initialLoad && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => {
            const ref = item.checklistItem?.frrRequirement
              ? `${item.checklistItem.frrRequirement.processId}/${item.checklistItem.frrRequirement.reqKey}`
              : item.checklistItem?.ksiIndicator?.indicatorId || item.checklistItem?.id;
            const text =
              item.checklistItem?.frrRequirement?.statement ||
              item.checklistItem?.ksiIndicator?.statement ||
              '';
            return (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected.includes(item.id)}
                        onChange={() => toggleSelected(item.id)}
                        className="size-4 rounded border-input accent-primary"
                        aria-label={`Select recommendation ${ref}`}
                      />
                      <span className="text-sm font-semibold">{ref}</span>
                      <Badge className={cn('border', decisionBadgeVariant(item.decision))}>
                        {item.decision}
                      </Badge>
                      <Badge variant="secondary">{item.status}</Badge>
                      <Badge variant="outline">
                        confidence {Math.round(item.confidence * 100)}%
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="xs"
                        disabled={item.status !== 'pending_review'}
                        onClick={() => approve(item.id)}
                      >
                        <Check className="size-3" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={item.status !== 'pending_review'}
                        onClick={() => reject(item.id)}
                      >
                        <X className="size-3" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {text && <p className="text-sm text-muted-foreground">{text}</p>}
                  <p className="text-sm">
                    <span className="font-medium">Rule:</span>{' '}
                    <span className="text-muted-foreground">{item.ruleId}</span>
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Rationale:</span>{' '}
                    <span className="text-muted-foreground">{item.rationale}</span>
                  </p>
                  {item.matchedFacts && item.matchedFacts.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.matchedFacts.map((f) => (
                        <Badge key={f} variant="secondary">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {item.explainability && (
                    <details>
                      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                        Explainability details
                      </summary>
                      <pre className="mt-2 overflow-x-auto rounded-[4px] border bg-muted/30 p-2.5 text-xs text-muted-foreground">
                        {JSON.stringify(item.explainability, null, 2)}
                      </pre>
                    </details>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
