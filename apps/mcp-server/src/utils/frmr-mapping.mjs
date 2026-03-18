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
