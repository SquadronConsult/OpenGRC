import { resolveWorkspaceRoot, resolveTargetPath, textResult } from '../helpers.mjs';
import { scanRepoInventory } from '../utils/repo.mjs';

export const tools = [
  {
    name: 'repo_inventory_v1',
    description:
      'Discover languages, frameworks, IaC footprint, and security signals for a repository.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        workspacePath: {
          type: 'string',
          description: 'Absolute workspace root path to analyze',
        },
        path: { type: 'string', description: 'Relative or absolute repo path' },
      },
    },
  },
];

export async function handle(name, args) {
  if (name !== 'repo_inventory_v1') return null;
  const workspaceRoot = resolveWorkspaceRoot(args);
  const root = resolveTargetPath(workspaceRoot, args.path);
  const inventory = await scanRepoInventory(root);
  return textResult(inventory);
}
