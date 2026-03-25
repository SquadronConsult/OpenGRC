import { enrichGapWithFrmrTargets } from '../frmr-mapping.mjs';

/**
 * @param {Record<string, unknown>} inventory from scanRepoInventory
 * @returns {Array<Record<string, unknown>>}
 */
export function runAllDetectors(inventory) {
  const raw = [];
  const hints = inventory?.contextHints || {};
  const ciWorkflowFiles = Array.isArray(hints.ciWorkflowFiles) ? hints.ciWorkflowFiles : [];
  const complianceFiles = Array.isArray(hints.complianceFiles) ? hints.complianceFiles : [];
  const lockfiles = Array.isArray(hints.lockfiles) ? hints.lockfiles : [];
  const dockerfiles = Array.isArray(hints.dockerfiles) ? hints.dockerfiles : [];
  const iacFiles = Array.isArray(hints.iacFiles) ? hints.iacFiles : [];
  const dockerComposeFiles = Array.isArray(hints.dockerComposeFiles)
    ? hints.dockerComposeFiles
    : [];
  const authConfigFiles = Array.isArray(hints.authConfigFiles) ? hints.authConfigFiles : [];
  const preCommitConfig = Array.isArray(hints.preCommitConfig) ? hints.preCommitConfig : [];

  const frameworks = Array.isArray(inventory?.frameworks) ? inventory.frameworks : [];
  const languages = Array.isArray(inventory?.languages) ? inventory.languages : [];
  const sig = inventory?.securitySignals || {};
  const iac = inventory?.iac || {};

  // --- Original four detectors (ids stable) ---
  if (!sig.hasCi) {
    raw.push({
      id: 'gap-ci-missing',
      severity: 'high',
      controlFamily: 'CM/SI',
      description: 'CI pipeline not detected; continuous validation controls likely weak.',
      recommendation:
        'Add CI workflow with lint/test/build and vulnerability scanning gates.',
      controlIntent: {
        fedramp: ['CM-3', 'CM-6', 'SI-2', 'SI-7'],
        frmr: ['continuous_validation', 'change_control', 'vulnerability_management'],
      },
      contextTargets: {
        ciWorkflowFiles,
        complianceFiles: complianceFiles.slice(0, 10),
      },
      acceptanceCriteria: [
        'CI runs lint/test/build on push and pull_request',
        'Security scanning runs in CI and blocks high/critical findings by policy',
        'Workflow artifacts or run URLs are referenceable for evidence ingest',
      ],
    });
  }
  if (!sig.hasDependencyLock) {
    raw.push({
      id: 'gap-lockfile-missing',
      severity: 'high',
      controlFamily: 'RA/SI',
      description: 'Dependency lockfile not detected; reproducibility and vuln management risk.',
      recommendation: 'Commit lockfiles and enforce deterministic dependency install in CI.',
      controlIntent: {
        fedramp: ['CM-2', 'RA-5', 'SI-2'],
        frmr: ['dependency_integrity', 'vulnerability_management'],
      },
      contextTargets: {
        lockfiles,
        ciWorkflowFiles,
      },
      acceptanceCriteria: [
        'At least one ecosystem lockfile committed and used in CI',
        'Dependency install is deterministic and reproducible',
      ],
    });
  }
  if (sig.hasSecretsFiles) {
    raw.push({
      id: 'gap-secrets-files',
      severity: 'critical',
      controlFamily: 'SC/IA',
      description: 'Potential secrets file patterns detected in repository.',
      recommendation:
        'Move secrets to env manager/secret store and add pre-commit secret scanning.',
      controlIntent: {
        fedramp: ['SC-28', 'IA-5', 'CM-6'],
        frmr: ['secret_management', 'credential_hygiene'],
      },
      contextTargets: {
        complianceFiles: complianceFiles.slice(0, 10),
      },
      acceptanceCriteria: [
        'No plaintext secret files tracked in repository',
        'Secret scanning enabled pre-commit and/or CI',
      ],
    });
  }
  if ((iac?.terraformFiles || 0) > 0 && !sig.hasSast) {
    raw.push({
      id: 'gap-iac-scanning',
      severity: 'medium',
      controlFamily: 'RA/CM',
      description: 'IaC detected without obvious security scan tooling signals.',
      recommendation: 'Add IaC scanner checks (tfsec/checkov/trivy config scan) in CI.',
      controlIntent: {
        fedramp: ['RA-5', 'CM-6', 'CA-7'],
        frmr: ['iac_posture_validation', 'continuous_monitoring'],
      },
      contextTargets: {
        iacFiles: iacFiles.slice(0, 20),
        ciWorkflowFiles,
        dockerfiles: dockerfiles.slice(0, 10),
      },
      acceptanceCriteria: [
        'IaC scan runs on every infrastructure change',
        'Scan output is retained for compliance evidence',
      ],
    });
  }

  const isWebUi = frameworks.includes('nextjs') || frameworks.includes('react');
  if (isWebUi && !sig.hasDast) {
    raw.push({
      id: 'gap-dast-missing',
      severity: 'medium',
      controlFamily: 'CA/RA',
      description: 'Web UI stack detected without dynamic application security testing signals.',
      recommendation:
        'Add DAST (OWASP ZAP, StackHawk, or pipeline-integrated scanner) to release testing.',
      controlIntent: {
        fedramp: ['CA-8', 'RA-5'],
        frmr: ['application_security_testing', 'continuous_monitoring'],
      },
      contextTargets: { ciWorkflowFiles },
      acceptanceCriteria: [
        'DAST runs against a representative staging environment',
        'High/critical findings tracked to closure or accepted risk',
      ],
    });
  }

  const isBackend =
    frameworks.includes('nestjs') ||
    frameworks.includes('express') ||
    languages.includes('typescript');
  if (isBackend && !sig.hasStructuredLogging) {
    raw.push({
      id: 'gap-structured-logging-missing',
      severity: 'medium',
      controlFamily: 'AU/CM',
      description: 'Backend services without clear structured logging library signals.',
      recommendation:
        'Standardize on structured logs (JSON) with correlation IDs forwarded to centralized logging.',
      controlIntent: {
        fedramp: ['AU-2', 'AU-12', 'CM-6'],
        frmr: ['logging_and_monitoring', 'audit_evidence'],
      },
      contextTargets: { ciWorkflowFiles },
      acceptanceCriteria: [
        'Application emits structured logs with request correlation',
        'Logs are aggregated and retained per retention policy',
      ],
    });
  }

  const containerSurface =
    frameworks.includes('docker') || (iac?.k8sYamlFiles || 0) > 0;
  if (containerSurface && !sig.hasSbomGeneration) {
    raw.push({
      id: 'gap-sbom-signal-missing',
      severity: 'medium',
      controlFamily: 'SA/CM',
      description: 'Container or Kubernetes manifests present without SBOM generation signals.',
      recommendation:
        'Generate CycloneDX/SPDX SBOMs in CI (Syft, build plugins) and store with artifacts.',
      controlIntent: {
        fedramp: ['SA-8', 'SA-10', 'CM-8'],
        frmr: ['software_supply_chain', 'configuration_management'],
      },
      contextTargets: {
        dockerfiles: dockerfiles.slice(0, 10),
        iacFiles: iacFiles.slice(0, 15),
      },
      acceptanceCriteria: [
        'SBOM produced for each release artifact',
        'SBOMs are archived for assessor review',
      ],
    });
  }

  if (sig.hasCi && !sig.hasSecretScanning) {
    raw.push({
      id: 'gap-ci-secret-scan-missing',
      severity: 'high',
      controlFamily: 'SI/IA',
      description: 'CI present but no secret scanning tool references found in repository paths.',
      recommendation:
        'Add Gitleaks, TruffleHog, or GitHub secret scanning workflows to block leaked credentials.',
      controlIntent: {
        fedramp: ['SI-11', 'IA-5'],
        frmr: ['credential_hygiene', 'secret_management'],
      },
      contextTargets: { ciWorkflowFiles },
      acceptanceCriteria: [
        'Secret scanning runs on every PR',
        'Leaked secrets fail the pipeline or open tracked exceptions',
      ],
    });
  }

  if (sig.hasCi && !sig.hasCodeowners) {
    raw.push({
      id: 'gap-codeowners-missing',
      severity: 'low',
      controlFamily: 'CM/AC',
      description: 'No CODEOWNERS file detected while CI workflows exist.',
      recommendation:
        'Add CODEOWNERS for sensitive paths (auth, infra, compliance) to enforce review.',
      controlIntent: {
        fedramp: ['CM-3', 'AC-2'],
        frmr: ['change_control', 'access_governance'],
      },
      contextTargets: { ciWorkflowFiles },
      acceptanceCriteria: [
        'CODEOWNERS covers security-sensitive directories',
        'PR rules require owner approval where defined',
      ],
    });
  }

  if (sig.hasDependencyLock && !sig.hasLicenseChecker) {
    raw.push({
      id: 'gap-license-tooling-missing',
      severity: 'low',
      controlFamily: 'CM/RA',
      description: 'Lockfiles present without license compliance scanning signals.',
      recommendation:
        'Add license policy checks (allow-list, FOSSA, licensed gem, npm license checker) in CI.',
      controlIntent: {
        fedramp: ['CM-8', 'RA-3'],
        frmr: ['supply_chain_governance', 'risk_assessment'],
      },
      contextTargets: { lockfiles },
      acceptanceCriteria: [
        'Disallowed licenses fail CI or require exception workflow',
        'Third-party notices updated with releases',
      ],
    });
  }

  if (
    (languages.includes('typescript') || languages.includes('javascript')) &&
    preCommitConfig.length === 0
  ) {
    raw.push({
      id: 'gap-precommit-missing',
      severity: 'low',
      controlFamily: 'CM/SI',
      description: 'No .pre-commit-config.yaml detected for local developer security hooks.',
      recommendation:
        'Add pre-commit with secret scanning and formatter/linter stages to shift-left.',
      controlIntent: {
        fedramp: ['CM-3', 'SI-7'],
        frmr: ['developer_security', 'continuous_validation'],
      },
      contextTargets: { ciWorkflowFiles },
      acceptanceCriteria: [
        'Developers run pre-commit hooks or CI enforces equivalent checks',
        'Secret patterns blocked before push',
      ],
    });
  }

  if (dockerComposeFiles.length > 0) {
    raw.push({
      id: 'gap-docker-compose-review',
      severity: 'medium',
      controlFamily: 'SC/AC',
      description: 'Docker Compose files detected; validate network segmentation and secrets handling.',
      recommendation:
        'Review compose networks, avoid default bridge exposure, inject secrets via env/secret stores.',
      controlIntent: {
        fedramp: ['SC-7', 'AC-4'],
        frmr: ['network_segmentation', 'secure_configuration'],
      },
      contextTargets: { dockerComposeFiles },
      acceptanceCriteria: [
        'Compose services use non-default networks where required',
        'No long-lived secrets committed in compose files',
      ],
    });
  }

  if (frameworks.includes('nestjs') && !sig.hasAuthConfig) {
    raw.push({
      id: 'gap-service-auth-hardening',
      severity: 'medium',
      controlFamily: 'AC/IA',
      description: 'NestJS-style API layout without obvious JWT/session auth module signals.',
      recommendation:
        'Verify authentication/authorization guards, MFA for privileged routes, and token validation.',
      controlIntent: {
        fedramp: ['AC-2', 'AC-3', 'IA-2'],
        frmr: ['identity_and_access', 'authentication'],
      },
      contextTargets: { authConfigFiles },
      acceptanceCriteria: [
        'All API routes classified for authn/authz requirements',
        'Integration tests cover negative authorization cases',
      ],
    });
  }

  if (sig.hasOpenApiSpec && !sig.hasDast) {
    raw.push({
      id: 'gap-openapi-dast-missing',
      severity: 'medium',
      controlFamily: 'CA/RA',
      description: 'OpenAPI/Swagger artifacts detected without DAST pipeline signals.',
      recommendation: 'Drive DAST from the published API spec against a safe test environment.',
      controlIntent: {
        fedramp: ['CA-8', 'RA-5'],
        frmr: ['application_security_testing', 'security_assessment'],
      },
      contextTargets: { ciWorkflowFiles },
      acceptanceCriteria: [
        'API contract tests and DAST cover critical endpoints',
        'Results tracked with POA&M or risk acceptance',
      ],
    });
  }

  return raw.map((g) => enrichGapWithFrmrTargets(g));
}
