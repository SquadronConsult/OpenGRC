import { DerivedFact } from './auto-scope.types';

type Snapshot = {
  sourceType: string;
  data?: Record<string, unknown> | null;
  summary?: Record<string, unknown> | null;
};

function boolFact(
  source: string,
  key: string,
  value: boolean,
  rationale: string,
  strength = 0.7,
): DerivedFact {
  return {
    source,
    key,
    valueType: 'boolean',
    value,
    strength,
    rationale,
  };
}

function strFact(
  source: string,
  key: string,
  value: string,
  rationale: string,
  strength = 0.65,
): DerivedFact {
  return {
    source,
    key,
    valueType: 'string',
    value,
    strength,
    rationale,
  };
}

function numFact(
  source: string,
  key: string,
  value: number,
  rationale: string,
  strength = 0.75,
): DerivedFact {
  return {
    source,
    key,
    valueType: 'number',
    value,
    strength,
    rationale,
  };
}

export function deriveFactsFromSnapshots(snapshots: Snapshot[]): DerivedFact[] {
  const facts: DerivedFact[] = [];
  for (const s of snapshots) {
    if (s.sourceType === 'repo') {
      const detected = (s.data?.detected as string[]) || [];
      facts.push(
        boolFact(
          'repo',
          'has_ci_pipeline',
          detected.some((x) => x.includes('ci')),
          'Detected CI workflow files in repository',
        ),
      );
      facts.push(
        boolFact(
          'repo',
          'uses_containers',
          detected.some((x) => x.includes('docker')),
          'Detected Docker artifacts',
        ),
      );
      facts.push(
        boolFact(
          'repo',
          'has_public_api',
          detected.some((x) => x.includes('openapi') || x.includes('express') || x.includes('nestjs')),
          'Detected API service signatures',
          0.6,
        ),
      );
    }

    if (s.sourceType === 'iac') {
      const providers = (s.data?.providers as string[]) || [];
      facts.push(boolFact('iac', 'cloud_aws', providers.includes('aws'), 'IaC references AWS provider', 0.8));
      facts.push(boolFact('iac', 'cloud_azure', providers.includes('azure'), 'IaC references Azure provider', 0.8));
      facts.push(boolFact('iac', 'cloud_gcp', providers.includes('gcp'), 'IaC references GCP provider', 0.8));
      facts.push(
        boolFact(
          'iac',
          'uses_kubernetes',
          providers.includes('kubernetes'),
          'IaC manifests indicate Kubernetes resources',
          0.75,
        ),
      );
      facts.push(
        boolFact(
          'iac',
          'uses_terraform',
          ((s.summary?.terraformFiles as number) || 0) > 0,
          'Terraform files discovered',
          0.8,
        ),
      );
      facts.push(
        boolFact(
          'iac',
          'uses_cloudformation',
          ((s.summary?.cloudFormationFiles as number) || 0) > 0,
          'CloudFormation templates discovered',
          0.8,
        ),
      );
    }

    if (s.sourceType === 'aws') {
      const accountId = String(s.data?.accountId || '');
      if (accountId) {
        facts.push(strFact('aws', 'aws_account_id', accountId, 'AWS metadata connector account id', 0.9));
        facts.push(boolFact('aws', 'cloud_aws', true, 'AWS connector configured', 0.9));
      }
      const resources = (s.data?.resources || {}) as Record<string, unknown>;
      const ec2 = Number(resources.ec2Instances || 0);
      const lambdas = Number(resources.lambdaFunctions || 0);
      const s3 = Number(resources.s3Buckets || 0);
      if (ec2 > 0) facts.push(numFact('aws', 'aws_ec2_instances', ec2, 'Detected EC2 inventory from AWS live connector', 0.85));
      if (lambdas > 0) facts.push(numFact('aws', 'aws_lambda_functions', lambdas, 'Detected Lambda inventory from AWS live connector', 0.85));
      if (s3 > 0) facts.push(numFact('aws', 'aws_s3_buckets', s3, 'Detected S3 inventory from AWS live connector', 0.85));
    }

    if (s.sourceType === 'azure') {
      const subId = String(s.data?.subscriptionId || '');
      if (subId) {
        facts.push(strFact('azure', 'azure_subscription_id', subId, 'Azure metadata connector subscription id', 0.9));
        facts.push(boolFact('azure', 'cloud_azure', true, 'Azure connector configured', 0.9));
      }
      const resources = (s.data?.resources || {}) as Record<string, unknown>;
      const total = Number(resources.total || 0);
      const vmCount = Number(resources.virtualMachines || 0);
      if (total > 0) facts.push(numFact('azure', 'azure_resources_total', total, 'Detected Azure resources from live connector', 0.85));
      if (vmCount > 0) facts.push(numFact('azure', 'azure_virtual_machines', vmCount, 'Detected Azure VM inventory from live connector', 0.85));
    }

    if (s.sourceType === 'gcp') {
      const projectId = String(s.data?.projectId || '');
      if (projectId) {
        facts.push(strFact('gcp', 'gcp_project_id', projectId, 'GCP metadata connector project id', 0.9));
        facts.push(boolFact('gcp', 'cloud_gcp', true, 'GCP connector configured', 0.9));
      }
      const resources = (s.data?.resources || {}) as Record<string, unknown>;
      const enabledServices = Number(resources.enabledServices || 0);
      const computeInstances = Number(resources.computeInstances || 0);
      if (enabledServices > 0) facts.push(numFact('gcp', 'gcp_enabled_services', enabledServices, 'Detected enabled services from GCP live connector', 0.85));
      if (computeInstances > 0) facts.push(numFact('gcp', 'gcp_compute_instances', computeInstances, 'Detected Compute Engine inventory from GCP live connector', 0.85));
    }
  }

  // Generalized environmental facts
  const hasAnyCloud = facts.some(
    (f) =>
      (f.key === 'cloud_aws' || f.key === 'cloud_azure' || f.key === 'cloud_gcp') &&
      f.value === true,
  );
  facts.push(
    boolFact(
      'derived',
      'cloud_managed',
      hasAnyCloud,
      'At least one cloud provider detected from IaC or metadata connectors',
      0.7,
    ),
  );
  facts.push(
    boolFact(
      'derived',
      'has_logging_stack',
      facts.some((f) => f.key === 'has_ci_pipeline' && f.value === true),
      'CI artifacts commonly include pipeline logs and runtime audit trails',
      0.45,
    ),
  );

  return facts;
}
