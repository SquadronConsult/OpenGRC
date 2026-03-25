import { textResult } from '../helpers.mjs';
import { integrationCatalogCrossMapV1 } from '../utils/opengrc.mjs';

export const tools = [
  {
    name: 'catalog_cross_map_v1',
    description:
      'Read cross-framework internal-control ↔ catalog requirement mappings (optionally filter by source/target framework codes).',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        sourceFramework: { type: 'string' },
        targetFramework: { type: 'string' },
      },
    },
  },
];

export async function handle(name, args) {
  if (name === 'catalog_cross_map_v1') {
    const result = await integrationCatalogCrossMapV1({
      sourceFramework: args?.sourceFramework,
      targetFramework: args?.targetFramework,
    });
    return textResult(result);
  }
  return null;
}
