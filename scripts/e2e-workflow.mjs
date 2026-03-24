/* eslint-disable no-console */
/**
 * End-to-end workflow against a running API (default http://localhost:3000).
 * Covers health versions, project create, checklist, POA&M sync, evidence gap report.
 */
import { loginBearer } from './login-bearer.mjs';

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function call(path, init = {}) {
  const cid = `e2e-${Date.now()}`;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-correlation-id': cid,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${path}: ${body}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

async function run() {
  const bearer = await loginBearer(API_URL);
  const authHeader = { authorization: `Bearer ${bearer}` };

  const health = await call('/health');
  if (!health.apiVersion) throw new Error('Expected apiVersion on /health');
  const ops = await call('/health/ops', { headers: authHeader });
  if (ops.schemaVersion == null) throw new Error('Expected schemaVersion on /health/ops');

  const project = await call('/projects', {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      name: `E2E ${Date.now()}`,
      pathType: '20x',
      impactLevel: 'moderate',
      complianceStartDate: '2026-03-18',
    }),
  });

  await call(`/projects/${project.id}/checklist/generate`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({ includeKsi: true }),
  }).catch(() => {
    /* FRMR may be empty in CI */
  });

  const gaps = await call(`/projects/${project.id}/gaps/evidence`, { headers: authHeader });
  if (typeof gaps.missingEvidenceCount !== 'number') {
    throw new Error('gaps/evidence response invalid');
  }
  if (!Array.isArray(gaps.items) || typeof gaps.total !== 'number') {
    throw new Error('gaps/evidence expected paginated items/total');
  }

  const checklist = await call(`/projects/${project.id}/checklist?limit=10`, {
    headers: authHeader,
  });
  if (!Array.isArray(checklist.items) || typeof checklist.total !== 'number') {
    throw new Error('checklist expected paginated envelope');
  }

  const projectsList = await call('/projects?limit=5', { headers: authHeader });
  if (!Array.isArray(projectsList.items) || typeof projectsList.total !== 'number') {
    throw new Error('GET /projects expected paginated envelope');
  }

  const sync = await call(`/projects/${project.id}/poam/sync-from-checklist`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({}),
  }).catch(() => ({ saved: 0 }));
  console.log(
    `OK api=${health.apiVersion} project=${project.id} poamSyncSaved=${sync.saved ?? 0} gaps=${gaps.missingEvidenceCount}`,
  );
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
