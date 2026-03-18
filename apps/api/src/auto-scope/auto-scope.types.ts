export type AutoScopeDecision = 'applicable' | 'not_applicable' | 'inherited';

export type AutoScopeRecommendationStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'stale';

export type AutoScopeConnectorToggle = {
  repo?: boolean;
  iac?: boolean;
  aws?: boolean;
  azure?: boolean;
  gcp?: boolean;
};

export type AutoScopeCloudOptions = {
  aws?: {
    accountId?: string;
    regions?: string[];
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
  };
  azure?: {
    subscriptionId?: string;
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
  };
  gcp?: {
    projectId?: string;
    serviceAccountJson?: string;
  };
};

export type AutoScopeRunOptions = {
  repoPath?: string;
  inventoryMode?: 'metadata' | 'live';
  connectors?: AutoScopeConnectorToggle;
  cloud?: AutoScopeCloudOptions;
};

export type DerivedFact = {
  source: string;
  key: string;
  valueType: string;
  value: unknown;
  strength: number;
  rationale?: string;
};

export type RuleEvaluationResult = {
  decision: AutoScopeDecision;
  ruleId: string;
  confidence: number;
  rationale: string;
  matchedFacts: string[];
  explainability: Record<string, unknown>;
};
