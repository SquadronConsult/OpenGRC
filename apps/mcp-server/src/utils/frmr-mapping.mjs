const GAP_TARGETS = {
  'gap-ci-missing': {
    frmrTargets: [
      {
        processId: 'ID.GV',
        reqKey: 'GV-01',
        rationale: 'Continuous validation and governance evidence should be automated in CI.',
      },
      {
        processId: 'ID.RA',
        reqKey: 'RA-05',
        rationale: 'Vulnerability scanning gates should be part of the release path.',
      },
      {
        processId: 'ID.SC',
        reqKey: 'SC-07',
        rationale: 'Secure delivery path and change control should be enforced before deployment.',
      },
    ],
    ksiTargets: ['KSI-CMT-VTD'],
    closeCriteria: [
      'A CI workflow exists under .github/workflows or equivalent CI entrypoint',
      'The workflow runs lint, test, build, and security scan stages',
      'The workflow can emit evidence references such as run URLs or artifacts',
    ],
  },
  'gap-lockfile-missing': {
    frmrTargets: [
      {
        processId: 'ID.AM',
        reqKey: 'AM-01',
        rationale: 'Dependencies should be inventoried and reproducible.',
      },
      {
        processId: 'ID.RA',
        reqKey: 'RA-05',
        rationale: 'Dependency risk must be assessable using deterministic versions.',
      },
    ],
    ksiTargets: ['KSI-CMT-SCM'],
    closeCriteria: [
      'At least one ecosystem lockfile is committed',
      'CI installs dependencies from lockfiles or equivalent pinned manifests',
    ],
  },
  'gap-secrets-files': {
    frmrTargets: [
      {
        processId: 'ID.SC',
        reqKey: 'SC-28',
        rationale: 'Secrets and sensitive data should not be stored in plaintext in source control.',
      },
      {
        processId: 'ID.IA',
        reqKey: 'IA-05',
        rationale: 'Credential hygiene requires managed secret handling and scanning.',
      },
    ],
    ksiTargets: ['KSI-DLP-PS'],
    closeCriteria: [
      'Plaintext secret material is removed from tracked files',
      'Secret scanning runs in pre-commit and/or CI',
    ],
  },
  'gap-iac-scanning': {
    frmrTargets: [
      {
        processId: 'ID.RA',
        reqKey: 'RA-05',
        rationale: 'Infrastructure risks should be assessed continuously.',
      },
      {
        processId: 'ID.CM',
        reqKey: 'CM-06',
        rationale: 'Infrastructure baseline changes should be validated before merge.',
      },
    ],
    ksiTargets: ['KSI-CMT-IAC'],
    closeCriteria: [
      'IaC scanning runs on infrastructure changes',
      'IaC scan output is preserved as evidence',
    ],
  },
  'gap-dast-missing': {
    frmrTargets: [
      { processId: 'ID.RA', reqKey: 'RA-05', rationale: 'Dynamic testing validates deployed behavior.' },
      { processId: 'ID.CA', reqKey: 'CA-08', rationale: 'Penetration-style testing informs control effectiveness.' },
    ],
    ksiTargets: ['KSI-APP-DAST'],
    closeCriteria: [
      'DAST integrated into release or scheduled security testing',
      'Critical findings remediated or risk-accepted with documentation',
    ],
  },
  'gap-structured-logging-missing': {
    frmrTargets: [
      { processId: 'ID.AU', reqKey: 'AU-02', rationale: 'Audit events must be generated for accountability.' },
      { processId: 'ID.AU', reqKey: 'AU-12', rationale: 'Centralized review requires structured exportable logs.' },
    ],
    ksiTargets: ['KSI-LOG-CENT'],
    closeCriteria: [
      'Structured logging with correlation IDs in production services',
      'Log retention and access align with AU policy',
    ],
  },
  'gap-sbom-signal-missing': {
    frmrTargets: [
      { processId: 'ID.SA', reqKey: 'SA-08', rationale: 'Development process integrity for software supply chain.' },
      { processId: 'ID.CM', reqKey: 'CM-08', rationale: 'Configuration baselines include software inventory.' },
    ],
    ksiTargets: ['KSI-SUP-SBOM'],
    closeCriteria: [
      'SBOM artifacts generated per release and archived',
      'SBOM reviewed for high-risk components',
    ],
  },
  'gap-ci-secret-scan-missing': {
    frmrTargets: [
      { processId: 'ID.SI', reqKey: 'SI-11', rationale: 'Error handling must not leak sensitive information.' },
      { processId: 'ID.IA', reqKey: 'IA-05', rationale: 'Authenticator management includes secret protection.' },
    ],
    ksiTargets: ['KSI-SEC-SCAN'],
    closeCriteria: [
      'Secret scanning enforced on default branch and PRs',
      'Violations block merge or follow exception process',
    ],
  },
  'gap-codeowners-missing': {
    frmrTargets: [
      { processId: 'ID.CM', reqKey: 'CM-03', rationale: 'Configuration control includes accountable reviewers.' },
      { processId: 'ID.AC', reqKey: 'AC-02', rationale: 'Account management ties to accountable parties.' },
    ],
    ksiTargets: ['KSI-CHG-OWN'],
    closeCriteria: [
      'CODEOWNERS covers security-sensitive paths',
      'Branch protections require owner review',
    ],
  },
  'gap-license-tooling-missing': {
    frmrTargets: [
      { processId: 'ID.CM', reqKey: 'CM-08', rationale: 'Information system component inventory is accurate.' },
      { processId: 'ID.RA', reqKey: 'RA-03', rationale: 'Risk assessment includes third-party software terms.' },
    ],
    ksiTargets: ['KSI-LIC-CMP'],
    closeCriteria: [
      'License policy automated in CI with allow/deny list',
      'Violations tracked to remediation or legal approval',
    ],
  },
  'gap-precommit-missing': {
    frmrTargets: [
      { processId: 'ID.CM', reqKey: 'CM-03', rationale: 'Developer workstations participate in change control.' },
      { processId: 'ID.SI', reqKey: 'SI-07', rationale: 'Software integrity verified at earliest practical point.' },
    ],
    ksiTargets: ['KSI-DEV-HOOK'],
    closeCriteria: [
      'Pre-commit or equivalent CI gates enforce secret and style checks',
      'Documentation for onboarding developers to hooks',
    ],
  },
  'gap-docker-compose-review': {
    frmrTargets: [
      { processId: 'ID.SC', reqKey: 'SC-07', rationale: 'Boundary protection for interconnected services.' },
      { processId: 'ID.AC', reqKey: 'AC-04', rationale: 'Information flow enforcement between containers.' },
    ],
    ksiTargets: ['KSI-NET-COMP'],
    closeCriteria: [
      'Compose networks reviewed for least-privilege connectivity',
      'Secrets injected via secure mechanisms, not committed',
    ],
  },
  'gap-service-auth-hardening': {
    frmrTargets: [
      { processId: 'ID.AC', reqKey: 'AC-03', rationale: 'Access enforcement for logical resources.' },
      { processId: 'ID.IA', reqKey: 'IA-02', rationale: 'Identification and authentication for organizational users.' },
    ],
    ksiTargets: ['KSI-API-AUTH'],
    closeCriteria: [
      'Authentication and authorization tests cover negative cases',
      'Privileged operations require MFA or equivalent',
    ],
  },
  'gap-openapi-dast-missing': {
    frmrTargets: [
      { processId: 'ID.CA', reqKey: 'CA-08', rationale: 'Red-team style testing of operational systems.' },
      { processId: 'ID.RA', reqKey: 'RA-05', rationale: 'Vulnerability scanning includes application layer.' },
    ],
    ksiTargets: ['KSI-API-DAST'],
    closeCriteria: [
      'API contract and DAST results aligned to critical endpoints',
      'Issues tracked in POA&M or risk register',
    ],
  },
};

export function enrichGapWithFrmrTargets(gap = {}) {
  const mapping = GAP_TARGETS[gap.id] || {
    frmrTargets: [],
    ksiTargets: [],
    closeCriteria: [],
  };

  return {
    ...gap,
    frmrTargets: mapping.frmrTargets,
    ksiTargets: mapping.ksiTargets,
    closeCriteria: mapping.closeCriteria,
  };
}

export function getGapTargetMapping(gapId) {
  return GAP_TARGETS[gapId] || null;
}
