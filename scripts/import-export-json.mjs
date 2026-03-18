/* eslint-disable no-console */
import { readFile } from 'fs/promises';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@localhost';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const INPUT = process.argv[2];

if (!INPUT) {
  console.error('Usage: node scripts/import-export-json.mjs <export.json>');
  process.exit(1);
}

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

function keyForExportRow(row) {
  if (row.requirement) return `REQ:${row.requirement.process}:${row.requirement.key}`;
  if (row.ksi) return `KSI:${row.ksi.id}`;
  return `ROW:${row.id}`;
}

function keyForChecklist(item) {
  if (item.frrRequirement) {
    return `REQ:${item.frrRequirement.processId}:${item.frrRequirement.reqKey}`;
  }
  if (item.ksiIndicator) return `KSI:${item.ksiIndicator.indicatorId}`;
  return `ROW:${item.id}`;
}

async function run() {
  const raw = await readFile(INPUT, 'utf-8');
  const src = JSON.parse(raw);

  const login = await call('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const token = login.access_token;
  const authJson = {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };
  const authOnly = { authorization: `Bearer ${token}` };

  const project = await call('/projects', {
    method: 'POST',
    headers: authJson,
    body: JSON.stringify({
      name: `${src.project.name} (Imported)`,
      pathType: src.project.pathType || '20x',
      impactLevel: src.project.impactLevel || 'Moderate',
      actorLabels: 'Cloud Service Provider',
    }),
  });

  await call(`/projects/${project.id}/checklist/generate`, {
    method: 'POST',
    headers: authJson,
    body: JSON.stringify({ includeKsi: true }),
  });

  const checklist = await call(`/projects/${project.id}/checklist`, {
    headers: authOnly,
  });

  const byKey = new Map();
  for (const item of checklist) byKey.set(keyForChecklist(item), item);

  for (const row of src.checklist || []) {
    const target = byKey.get(keyForExportRow(row));
    if (!target) continue;
    await call(`/checklist-items/${target.id}`, {
      method: 'PATCH',
      headers: authJson,
      body: JSON.stringify({ status: row.status || 'not_started' }),
    });
    for (const ev of row.evidence || []) {
      if (!ev.externalUri) continue;
      await call(`/checklist-items/${target.id}/evidence`, {
        method: 'POST',
        headers: authJson,
        body: JSON.stringify({ externalUri: ev.externalUri }),
      });
    }
  }

  console.log(`Imported into project ${project.id}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
