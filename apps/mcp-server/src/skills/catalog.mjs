/** NIST 800-53–aligned remediation playbooks (20 entries) for gap/remediation_plan coherence. */
export const skillCatalog = [
  {
    id: 'secure-api-input-validation',
    title: 'Secure API Input Validation',
    stacks: ['typescript', 'javascript', 'nestjs', 'express'],
    controls: ['SI-10', 'SC-7', 'RA-5'],
    description:
      'Tighten schema validation, enforce type-safe DTOs, and reject unsafe payloads at API boundaries.',
    playbook: [
      'Inventory request entry points and payload shapes.',
      'Introduce explicit schemas and strict runtime validation.',
      'Add fail-closed behavior for unknown fields and malformed input.',
      'Add negative tests for injection-like payloads.',
    ],
  },
  {
    id: 'dependency-and-supply-chain-hardening',
    title: 'Dependency and Supply Chain Hardening',
    stacks: ['typescript', 'javascript', 'python', 'go'],
    controls: ['RA-5', 'SI-2', 'CM-6'],
    description:
      'Harden package/update workflows with lockfiles, scanner gates, and trusted registries.',
    playbook: [
      'Ensure lockfiles are committed and used in CI.',
      'Enable dependency scanning and fail thresholds.',
      'Pin risky transitive dependencies where needed.',
      'Document upgrade cadence and exception process.',
    ],
  },
  {
    id: 'container-runtime-hardening',
    title: 'Container Runtime Hardening',
    stacks: ['docker', 'kubernetes'],
    controls: ['CM-6', 'SC-7', 'SI-7'],
    description:
      'Apply least privilege runtime settings, image minimization, and policy checks.',
    playbook: [
      'Use minimal base image and non-root user.',
      'Drop unnecessary Linux capabilities.',
      'Set read-only filesystem where possible.',
      'Enforce image scanning and signature verification.',
    ],
  },
  {
    id: 'identify-and-authenticate-organizational-users',
    title: 'Organizational User Identification & Authentication',
    stacks: ['nestjs', 'express', 'nextjs'],
    controls: ['IA-2', 'IA-5', 'AC-2'],
    description:
      'Strengthen login flows, MFA for privileged use, and secure session/token handling.',
    playbook: [
      'Map authentication entry points and token lifetimes.',
      'Enforce MFA or phishing-resistant methods for admins.',
      'Rotate secrets and use vault-backed configuration.',
    ],
  },
  {
    id: 'audit-logging-and-monitoring',
    title: 'Audit Logging & Monitoring',
    stacks: ['typescript', 'javascript', 'python'],
    controls: ['AU-2', 'AU-6', 'AU-12'],
    description:
      'Emit structured audit records with correlation IDs and centralized review.',
    playbook: [
      'Define auditable events for security-relevant actions.',
      'Use structured JSON logs with trace IDs.',
      'Forward to SIEM and set retention/access controls.',
    ],
  },
  {
    id: 'continuous-monitoring-and-assessment',
    title: 'Continuous Monitoring & Assessment',
    stacks: ['docker', 'kubernetes', 'typescript'],
    controls: ['CA-7', 'RA-5', 'SI-4'],
    description:
      'Automate control checks, vuln scanning, and metrics for ongoing authorization.',
    playbook: [
      'Wire scanners into CI/CD with quality gates.',
      'Track POA&M-style findings to closure.',
      'Review dashboards on a defined cadence.',
    ],
  },
  {
    id: 'configuration-management-baseline',
    title: 'Configuration Management Baseline',
    stacks: ['typescript', 'javascript', 'kubernetes', 'docker'],
    controls: ['CM-2', 'CM-6', 'CM-8'],
    description:
      'Maintain approved baselines and detect drift across environments.',
    playbook: [
      'Store IaC in VCS with peer review.',
      'Run config scanners on every change.',
      'Inventory components including containers and SaaS.',
    ],
  },
  {
    id: 'contingency-planning-backup-recovery',
    title: 'Contingency Planning (Backup & Recovery)',
    stacks: ['docker', 'kubernetes'],
    controls: ['CP-9', 'CP-10', 'IR-4'],
    description:
      'Ensure backups are encrypted, tested, and separated from production credentials.',
    playbook: [
      'Define RPO/RTO per tier.',
      'Automate backup verification restores.',
      'Protect backup admin paths from ransomware.',
    ],
  },
  {
    id: 'incident-response-readiness',
    title: 'Incident Response Readiness',
    stacks: ['typescript', 'javascript'],
    controls: ['IR-4', 'IR-8', 'SI-5'],
    description:
      'Prepare runbooks, on-call routing, and evidence preservation for incidents.',
    playbook: [
      'Define severity tiers and escalation.',
      'Integrate alerting with ticketing.',
      'Tabletop exercises for auth and data paths.',
    ],
  },
  {
    id: 'media-protection',
    title: 'Media Protection',
    stacks: ['docker'],
    controls: ['MP-4', 'MP-5', 'SC-28'],
    description:
      'Control removable media, snapshots, and volume encryption for sensitive data.',
    playbook: [
      'Encrypt data at rest for databases and volumes.',
      'Restrict snapshot sharing across accounts.',
      'Label data sensitivity in manifests.',
    ],
  },
  {
    id: 'physical-access-awareness',
    title: 'Physical Access (Cloud-Aware)',
    stacks: ['typescript', 'javascript', 'docker'],
    controls: ['PE-2', 'PE-3', 'PE-6'],
    description:
      'For cloud-native systems, map provider physical controls to shared responsibility.',
    playbook: [
      'Document provider attestations (SOC 2, FedRAMP P-ATO).',
      'Restrict hardware tokens and data center visits in policy.',
    ],
  },
  {
    id: 'security-planning-documentation',
    title: 'Security Planning & SSP Alignment',
    stacks: ['typescript'],
    controls: ['PL-2', 'PL-8', 'PM-9'],
    description:
      'Keep system boundary, architecture, and control narratives current.',
    playbook: [
      'Maintain one source of truth for system diagram.',
      'Trace controls to components.',
      'Review plan on major releases.',
    ],
  },
  {
    id: 'personnel-security-awareness',
    title: 'Personnel Security & Awareness',
    stacks: ['typescript', 'javascript'],
    controls: ['PS-3', 'PS-4', 'AT-2'],
    description:
      'Tie access to role changes and recurring secure-development training.',
    playbook: [
      'Offboard access in joiner-mover-leaver workflows.',
      'Security training for secrets and OWASP top risks.',
    ],
  },
  {
    id: 'risk-assessment-integration',
    title: 'Risk Assessment Integration',
    stacks: ['typescript', 'python'],
    controls: ['RA-3', 'RA-5', 'PM-28'],
    description:
      'Link architecture changes to documented risk and vulnerability posture.',
    playbook: [
      'Score new features against threat model.',
      'Feed scanner output into POA&M equivalents.',
    ],
  },
  {
    id: 'system-and-services-acquisition',
    title: 'System & Services Acquisition',
    stacks: ['typescript', 'javascript'],
    controls: ['SA-8', 'SA-9', 'SA-11'],
    description:
      'Bake security into SDLC: SAST/DAST, reviews, and vendor attestations.',
    playbook: [
      'Define security acceptance criteria per release.',
      'Require SBOM or dependency attestations for critical tiers.',
    ],
  },
  {
    id: 'boundary-and-network-protection',
    title: 'Boundary & Network Protection',
    stacks: ['docker', 'kubernetes', 'nestjs'],
    controls: ['SC-7', 'SC-8', 'AC-4'],
    description:
      'Segment networks, enforce TLS, and restrict east-west traffic.',
    playbook: [
      'Use private subnets and security groups.',
      'Terminate TLS at appropriate boundaries.',
      'Document allowed flows.',
    ],
  },
  {
    id: 'system-and-information-integrity',
    title: 'System & Information Integrity',
    stacks: ['typescript', 'javascript', 'python'],
    controls: ['SI-7', 'SI-10', 'SI-11'],
    description:
      'FIM, error handling without leaks, and malware defenses for build agents.',
    playbook: [
      'Enable file integrity monitoring on critical servers.',
      'Sanitize errors returned to clients.',
      'Scan build nodes periodically.',
    ],
  },
  {
    id: 'system-and-communications-protection',
    title: 'System & Communications Protection',
    stacks: ['nestjs', 'express', 'nextjs'],
    controls: ['SC-8', 'SC-12', 'SC-13'],
    description:
      'Encrypt data in transit, manage keys, and protect session channels.',
    playbook: [
      'Enforce TLS 1.2+ and HSTS where applicable.',
      'Use KMS/HSM patterns for key material.',
    ],
  },
  {
    id: 'supply-chain-risk-management',
    title: 'Supply Chain Risk Management',
    stacks: ['typescript', 'javascript', 'go'],
    controls: ['SR-3', 'SR-5', 'SR-8'],
    description:
      'Address provenance, build pipelines, and third-party package risk.',
    playbook: [
      'Sign artifacts and verify in deploy.',
      'Pin CI actions and npm packages.',
      'Monitor for typosquatting on critical deps.',
    ],
  },
  {
    id: 'program-management-security',
    title: 'Program Management (Security Program)',
    stacks: ['typescript'],
    controls: ['PM-9', 'PM-14', 'PM-31'],
    description:
      'Executive oversight, KPIs, and continuous improvement for the security program.',
    playbook: [
      'Track KPIs: MTTD, MTTR, vuln aging.',
      'Quarterly leadership review of risk register.',
    ],
  },
];

export function selectSkills({ objective = '', inventory = {} }) {
  const objectiveLc = String(objective).toLowerCase();
  const languages = new Set(inventory.languages || []);
  const frameworks = new Set(inventory.frameworks || []);
  return skillCatalog
    .filter((skill) => {
      const stackMatch = skill.stacks.some(
        (s) => languages.has(s) || frameworks.has(s),
      );
      const objectiveMatch =
        objectiveLc.length === 0 ||
        skill.title.toLowerCase().includes(objectiveLc) ||
        skill.description.toLowerCase().includes(objectiveLc) ||
        skill.controls.some((c) => objectiveLc.includes(c.toLowerCase()));
      return stackMatch || objectiveMatch;
    })
    .slice(0, 8);
}
