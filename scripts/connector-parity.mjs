/**
 * Validates that built-in connector ids in the registry match SDK naming conventions.
 * Run: node scripts/connector-parity.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const implDir = join(root, 'apps/api/src/connectors/impl');
const { readdirSync } = await import('fs');

const expected = [
  'synthetic',
  'github_repo',
  'gitlab_repo',
  'aws_cloudtrail',
  'aws_config',
  'okta_org',
  'entra_id',
  'jira_cloud',
  'linear_workspace',
  'slack_webhook',
  'teams_webhook',
];

const files = readdirSync(implDir).filter((f) => f.endsWith('.connector.ts'));
let failed = false;
for (const id of expected) {
  const ok = files.some((f) => {
    const src = readFileSync(join(implDir, f), 'utf8');
    return src.includes(`readonly id = '${id}'`);
  });
  if (!ok) {
    console.error(`Missing connector implementation for id: ${id}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
console.log('connector-parity: ok', expected.length, 'connectors');
