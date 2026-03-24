/* eslint-disable no-console */
import { spawn } from 'child_process';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import {
  ROOT,
  USER_CURSOR_DIR,
  MCP_DAEMON_URL,
  getWorkspaceMcpJson,
  getInstallDeepLink,
} from './cursor-mcp-common.mjs';

const WORKSPACE_CURSOR_DIR = path.join(ROOT, '.cursor');
const WORKSPACE_MCP_CONFIG_PATH = path.join(WORKSPACE_CURSOR_DIR, 'mcp.json');
const GLOBAL_MCP_CONFIG_PATH = path.join(USER_CURSOR_DIR, 'mcp.json');
/** API base URL for health checks (Docker all-in-one: use /api prefix on port 8080). */
const API_URL = process.env.API_URL || 'http://localhost:8080/api';
const WEB_URL = process.env.WEB_URL || 'http://localhost:8080';
const HEALTH_PATH = '/health';
const IS_WINDOWS = process.platform === 'win32';

function normalizeCommand(command) {
  if (command.includes(' ')) return command;
  if (!IS_WINDOWS) return command;
  if (command === 'npm') return 'npm.cmd';
  if (command === 'npx') return 'npx.cmd';
  return command;
}

function run(command, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(normalizeCommand(command), args, {
      stdio: 'inherit',
      shell: false,
      ...opts,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
    });
  });
}

async function waitForHealth(url, timeoutMs = 90000, intervalMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return true;
    } catch {
      // ignore while booting
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

async function readJsonSafe(filePath, fallback) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeCursorMcpConfig(configPath, mode = 'global') {
  await mkdir(path.dirname(configPath), { recursive: true });
  const current = await readJsonSafe(configPath, { mcpServers: {} });
  if (!current.mcpServers || typeof current.mcpServers !== 'object') {
    current.mcpServers = {};
  }
  const desired = getWorkspaceMcpJson(mode);
  current.mcpServers['open-grc-mcp'] = desired.mcpServers['open-grc-mcp'];

  await writeFile(configPath, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
}

async function main() {
  console.log('\n[1/4] Building and starting Docker (all-in-one: opengrc)...');
  await run('docker', ['compose', 'up', '-d', '--build', 'opengrc'], {
    cwd: ROOT,
  });

  console.log('\n[2/4] Waiting for API health...');
  const ok = await waitForHealth(`${API_URL}${HEALTH_PATH}`);
  if (!ok) {
    throw new Error(
      `API did not become healthy at ${API_URL}${HEALTH_PATH}. Check: docker compose logs opengrc`,
    );
  }

  console.log('\n[3/4] Starting host MCP HTTP daemon...');
  await run('node', ['scripts/mcp-daemon.mjs', 'start'], {
    cwd: ROOT,
    shell: IS_WINDOWS,
  });

  console.log('\n[4/4] Writing Cursor MCP config (global + workspace)...');
  await writeCursorMcpConfig(GLOBAL_MCP_CONFIG_PATH, 'global');
  await writeCursorMcpConfig(WORKSPACE_MCP_CONFIG_PATH, 'workspace');

  console.log('\nOne-click deployment complete.\n');
  console.log(`- Web UI: ${WEB_URL}`);
  console.log(`- API: ${API_URL}`);
  console.log(`- MCP URL: ${MCP_DAEMON_URL}`);
  console.log(`- Cursor MCP global config: ${GLOBAL_MCP_CONFIG_PATH}`);
  console.log(`- Cursor MCP workspace config: ${WORKSPACE_MCP_CONFIG_PATH}`);
  console.log(`- Cursor one-click install link: ${getInstallDeepLink()}`);
  console.log('\nCopy/paste JSON option: npm run cursor:mcp-json');
  console.log('Clipboard helper option: npm run cursor:mcp-copy');
  console.log('Open one-click link: npm run cursor:mcp-install');
  console.log('\nIn Cursor, reload MCP servers and call tool `ping` on `open-grc-mcp`.\n');
}

main().catch((err) => {
  console.error(`\nDeployment failed: ${err.message}\n`);
  process.exit(1);
});
