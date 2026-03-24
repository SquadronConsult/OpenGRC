/* eslint-disable no-console */
/**
 * Validates generic catalog + FRMR adapter: frameworks registered, checklist items
 * linked to catalog requirements after generate + backfill, optional stub package import
 * and one internal-control mapping (admin APIs).
 */
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loginBearer } from './login-bearer.mjs';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

async function call(path, init = {}) {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${path}: ${body}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

async function run() {
  await call('/health', { method: 'GET' }).catch(() => {
    throw new Error(`API not reachable at ${API_URL}`);
  });

  const token = await loginBearer(API_URL);
  const bearer = { authorization: `Bearer ${token}` };

  const frameworks = await call('/catalog/frameworks', { method: 'GET', headers: bearer });
  if (!Array.isArray(frameworks)) {
    throw new Error('GET /catalog/frameworks must return an array');
  }
  const frmrFw = frameworks.find((f) => f.code === 'fedramp_frmr');
  if (!frmrFw) {
    console.warn(
      'fedramp_frmr not in catalog yet (FRMR ingest/sync may still be running). Continuing checks.',
    );
  }

  const auth = { 'content-type': 'application/json', ...bearer };
  const project = await call('/projects', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      name: `Catalog parity ${Date.now()}`,
      pathType: '20x',
      impactLevel: 'moderate',
      actorLabels: 'Cloud Service Provider',
      complianceStartDate: '2026-03-18',
    }),
  });

  await call(`/projects/${project.id}/checklist/generate`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ includeKsi: true }),
  });

  const backfill = await call(`/projects/${project.id}/checklist/backfill-catalog`, {
    method: 'POST',
    headers: auth,
  });
  if (typeof backfill.updated !== 'number') {
    throw new Error('backfill-catalog response missing updated count');
  }

  const checklist = await call(`/projects/${project.id}/checklist`, {
    method: 'GET',
    headers: bearer,
  });
  if (!Array.isArray(checklist) || checklist.length === 0) {
    throw new Error('Expected non-empty checklist');
  }

  const withCatalog = checklist.filter((i) => i.catalogRequirementId);
  if (withCatalog.length === 0) {
    throw new Error(
      'No checklist items have catalogRequirementId after generate+backfill; FRMR catalog sync may have failed',
    );
  }

  const stubPath = join(ROOT, 'frameworks', 'packages', 'nist-csf-2-stub.json');
  const raw = await readFile(stubPath, 'utf-8');
  const pkg = JSON.parse(raw);
  const imp = await call('/catalog/import-package', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify(pkg),
  });
  if (!imp.ok || !imp.frameworkReleaseId) {
    throw new Error(`import-package failed: ${JSON.stringify(imp)}`);
  }

  const reqs = await call(`/catalog/releases/${imp.frameworkReleaseId}/requirements`, {
    method: 'GET',
    headers: bearer,
  });
  if (!Array.isArray(reqs) || reqs.length === 0) {
    throw new Error('Expected requirements after stub import');
  }
  const nistReqId = reqs[0].id;

  const ic = await call('/catalog/internal-controls', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      code: `og-parity-${Date.now()}`,
      title: 'Parity internal control',
    }),
  });
  if (!ic.ok || !ic.id) throw new Error(`internal-controls: ${JSON.stringify(ic)}`);

  const map = await call(`/catalog/internal-controls/${ic.id}/mappings`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      catalogRequirementId: nistReqId,
      frameworkCode: 'nist_csf_2',
      priorityRank: 10,
    }),
  });
  if (!map.ok) throw new Error(`mapping: ${JSON.stringify(map)}`);

  const exported = await call(`/projects/${project.id}/export?format=json`, {
    method: 'GET',
    headers: auth,
  });
  const first = exported?.checklist?.[0];
  if (first && first.catalog == null && first.requirement) {
    console.warn('Export JSON: catalog field null on first row (may be ok if item has no catalog link)');
  }

  console.log(
    `OK catalog parity project=${project.id} checklist=${checklist.length} withCatalog=${withCatalog.length} stubReq=${nistReqId} mapping=${map.mappingId}`,
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
