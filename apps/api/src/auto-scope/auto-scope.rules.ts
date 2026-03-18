import { ChecklistItem } from '../entities/checklist-item.entity';
import { RuleEvaluationResult } from './auto-scope.types';

type FactMap = Record<string, unknown>;

function asBool(v: unknown): boolean {
  return v === true;
}

function asNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function containsAny(text: string, terms: string[]): boolean {
  const lc = text.toLowerCase();
  return terms.some((t) => lc.includes(t));
}

function clamp(n: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, n));
}

export function evaluateApplicabilityRule(
  item: ChecklistItem,
  factMap: FactMap,
): RuleEvaluationResult {
  const statement = (
    item.frrRequirement?.statement ||
    item.ksiIndicator?.statement ||
    ''
  ).toLowerCase();

  const matchedFacts: string[] = [];
  const cloudManaged = asBool(factMap.cloud_managed);
  const hasAws = asBool(factMap.cloud_aws);
  const hasAzure = asBool(factMap.cloud_azure);
  const hasGcp = asBool(factMap.cloud_gcp);
  const usesK8s = asBool(factMap.uses_kubernetes);
  const usesContainers = asBool(factMap.uses_containers);
  const hasPublicApi = asBool(factMap.has_public_api);
  const awsInventorySignal =
    asNum(factMap.aws_ec2_instances) +
      asNum(factMap.aws_lambda_functions) +
      asNum(factMap.aws_s3_buckets) >
    0;
  const azureInventorySignal =
    asNum(factMap.azure_resources_total) + asNum(factMap.azure_virtual_machines) >
    0;
  const gcpInventorySignal =
    asNum(factMap.gcp_enabled_services) + asNum(factMap.gcp_compute_instances) >
    0;
  let confidence = 0.6;

  if (containsAny(statement, ['aws', 'lambda', 'cloudwatch', 's3']) && !hasAws) {
    matchedFacts.push('cloud_aws=false');
    return {
      decision: 'not_applicable',
      ruleId: 'rule.provider.aws.missing',
      confidence: 0.84,
      rationale:
        'Requirement references AWS-specific capabilities, but AWS was not detected in connector evidence.',
      matchedFacts,
      explainability: { provider: 'aws', signal: 'missing-provider-evidence' },
    };
  }

  if (containsAny(statement, ['azure', 'entra', 'defender for cloud']) && !hasAzure) {
    matchedFacts.push('cloud_azure=false');
    return {
      decision: 'not_applicable',
      ruleId: 'rule.provider.azure.missing',
      confidence: 0.84,
      rationale:
        'Requirement references Azure-specific capabilities, but Azure was not detected in connector evidence.',
      matchedFacts,
      explainability: { provider: 'azure', signal: 'missing-provider-evidence' },
    };
  }

  if (containsAny(statement, ['gcp', 'google cloud', 'cloud run']) && !hasGcp) {
    matchedFacts.push('cloud_gcp=false');
    return {
      decision: 'not_applicable',
      ruleId: 'rule.provider.gcp.missing',
      confidence: 0.84,
      rationale:
        'Requirement references GCP-specific capabilities, but GCP was not detected in connector evidence.',
      matchedFacts,
      explainability: { provider: 'gcp', signal: 'missing-provider-evidence' },
    };
  }

  if (containsAny(statement, ['kubernetes', 'pod', 'cluster']) && !usesK8s) {
    matchedFacts.push('uses_kubernetes=false');
    return {
      decision: 'not_applicable',
      ruleId: 'rule.platform.kubernetes.missing',
      confidence: 0.78,
      rationale:
        'Requirement appears Kubernetes-specific and Kubernetes evidence was not found.',
      matchedFacts,
      explainability: { platform: 'kubernetes', signal: 'missing-platform-evidence' },
    };
  }

  if (containsAny(statement, ['container', 'docker']) && !usesContainers) {
    matchedFacts.push('uses_containers=false');
    return {
      decision: 'not_applicable',
      ruleId: 'rule.platform.container.missing',
      confidence: 0.74,
      rationale:
        'Requirement appears container-specific and container evidence was not found.',
      matchedFacts,
      explainability: { platform: 'container', signal: 'missing-platform-evidence' },
    };
  }

  if (containsAny(statement, ['physical', 'facility', 'datacenter', 'hardware disposal']) && cloudManaged) {
    matchedFacts.push('cloud_managed=true');
    return {
      decision: 'inherited',
      ruleId: 'rule.sharedres.physical.cloud',
      confidence: 0.8,
      rationale:
        'Physical infrastructure controls are commonly inherited when workloads run on managed cloud providers.',
      matchedFacts,
      explainability: { sharedResponsibility: 'provider', domain: 'physical' },
    };
  }

  if (containsAny(statement, ['internet-facing', 'public endpoint', 'api gateway']) && !hasPublicApi) {
    matchedFacts.push('has_public_api=false');
    confidence += 0.1;
  }

  if (cloudManaged) {
    matchedFacts.push('cloud_managed=true');
    confidence += 0.05;
  }
  if (awsInventorySignal) {
    matchedFacts.push('aws_inventory=true');
    confidence += 0.05;
  }
  if (azureInventorySignal) {
    matchedFacts.push('azure_inventory=true');
    confidence += 0.05;
  }
  if (gcpInventorySignal) {
    matchedFacts.push('gcp_inventory=true');
    confidence += 0.05;
  }
  if (hasPublicApi) {
    matchedFacts.push('has_public_api=true');
    confidence += 0.05;
  }

  return {
    decision: 'applicable',
    ruleId: 'rule.default.applicable',
    confidence: clamp(confidence),
    rationale:
      'No exclusion rule matched and evidence indicates this control should remain in project scope.',
    matchedFacts,
    explainability: { fallback: 'default-applicable' },
  };
}
