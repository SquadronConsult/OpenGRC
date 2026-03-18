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
        skill.description.toLowerCase().includes(objectiveLc);
      return stackMatch || objectiveMatch;
    })
    .slice(0, 5);
}
