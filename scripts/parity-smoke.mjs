/* eslint-disable no-console */
import { loginBearer } from './login-bearer.mjs';

const API_URL = process.env.API_URL || 'http://localhost:3000';

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
  const token = await loginBearer(API_URL);
  const bearer = { authorization: `Bearer ${token}` };
  const auth = {
    'content-type': 'application/json',
    ...bearer,
  };

  const project = await call('/projects', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      name: `Parity Smoke ${Date.now()}`,
      pathType: '20x',
      impactLevel: 'moderate',
      actorLabels: 'Cloud Service Provider',
      complianceStartDate: '2026-03-18',
    }),
  });

  const generated = await call(`/projects/${project.id}/checklist/generate`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ includeKsi: true }),
  });

  const checklist = await call(`/projects/${project.id}/checklist`, {
    headers: bearer,
  });
  if (!Array.isArray(checklist) || checklist.length === 0) {
    throw new Error('Checklist was not generated');
  }

  const firstItemId = checklist[0].id;
  await call(`/checklist-items/${firstItemId}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ status: 'in_progress' }),
  });

  const findings = await call('/findings', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      checklistItemId: firstItemId,
      title: 'Smoke finding',
      description: 'Created by parity smoke test',
      severity: 'low',
    }),
  });

  await call('/comments', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      checklistItemId: firstItemId,
      body: 'Smoke comment',
    }),
  });

  const exported = await call(`/projects/${project.id}/export?format=md`, {
    headers: bearer,
  });
  if (typeof exported !== 'string' || !exported.includes('# SSP draft')) {
    throw new Error('Export markdown failed validation');
  }

  const risk = await call(`/projects/${project.id}/risks`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      title: 'Parity risk',
      description: 'Smoke risk row',
      category: 'operational',
      likelihood: 3,
      impact: 4,
      residualLikelihood: 2,
      residualImpact: 2,
    }),
  });
  if (!risk.id || risk.inherentScore !== 12) {
    throw new Error('Risk create or scoring failed');
  }
  const heatmap = await call(`/projects/${project.id}/risks/heatmap`, { headers: bearer });
  if (!heatmap.cells || typeof heatmap.total !== 'number') {
    throw new Error('Risk heatmap failed');
  }
  await call(`/projects/${project.id}/risks/${risk.id}/mitigations/checklist-items`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ checklistItemId: firstItemId }),
  });

  console.log(
    `OK project=${project.id} generated=${generated.created} checklist=${checklist.length} finding=${findings.id} risk=${risk.id}`,
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
