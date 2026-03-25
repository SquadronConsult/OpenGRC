import { textResult } from '../helpers.mjs';
import { getFrmrTaxonomy, getCatalogFrameworks } from '../utils/opengrc.mjs';

export const tools = [
  {
    name: 'frmr_taxonomy_v1',
    description:
      'Fetch FedRAMP Requirements and Metrics Repository (FRMR) taxonomy: processes, requirements, and Key Security Indicators (KSI). pathType 20x = FedRAMP 20x authorization path; rev5 = FedRAMP Rev 5 baseline. Use before planning or reporting.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        pathType: { type: 'string', enum: ['20x', 'rev5'] },
        layer: { type: 'string', enum: ['both', '20x', 'rev5'] },
        actor: { type: 'string' },
      },
    },
  },
  {
    name: 'catalog_frameworks_v1',
    description:
      'List generic compliance frameworks registered in the catalog (fedramp_frmr, nist_csf_2, …). Complements frmr_taxonomy_v1 with stable framework codes.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
];

export async function handle(name, args) {
  if (name === 'frmr_taxonomy_v1') {
    const result = await getFrmrTaxonomy(args);
    return textResult(result);
  }
  if (name === 'catalog_frameworks_v1') {
    const raw = await getCatalogFrameworks();
    const frameworks = Array.isArray(raw) ? raw : raw?.frameworks || [];
    return textResult({
      frameworks,
      aliases: { frmr: 'fedramp_frmr', fedramp: 'fedramp_frmr' },
    });
  }
  return null;
}
