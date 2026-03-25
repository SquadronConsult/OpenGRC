import { textResult } from '../helpers.mjs';
import { skillCatalog, selectSkills } from '../skills/catalog.mjs';

export const tools = [
  {
    name: 'list_skills_v1',
    description: 'List available control/remediation skills from MCP skill registry.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: 'run_skill_agent_v1',
    description:
      'Select and execute skill playbook recommendations for a control objective.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['objective'],
      properties: {
        objective: { type: 'string' },
        inventory: { type: 'object' },
      },
    },
  },
];

export async function handle(name, args) {
  if (name === 'list_skills_v1') {
    return textResult({
      count: skillCatalog.length,
      skills: skillCatalog,
    });
  }
  if (name === 'run_skill_agent_v1') {
    const objective = String(args.objective || '');
    const inventory = args.inventory || {};
    const selected = selectSkills({ objective, inventory });
    const runbook = selected.map((s) => ({
      id: s.id,
      title: s.title,
      controls: s.controls,
      actions: s.playbook,
    }));
    return textResult({
      objective,
      selectedSkills: selected.map((s) => s.id),
      runbook,
    });
  }
  return null;
}
