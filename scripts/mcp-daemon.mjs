/* eslint-disable no-console */
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import {
  ROOT,
  USER_CURSOR_DIR,
  MCP_DAEMON_HOST,
  MCP_DAEMON_PORT,
  MCP_DAEMON_PATH,
  MCP_DAEMON_URL,
} from './cursor-mcp-common.mjs';

const PID_FILE = path.join(USER_CURSOR_DIR, 'open-grc-mcp-http.pid');
const LOG_FILE = path.join(USER_CURSOR_DIR, 'open-grc-mcp-http.log');

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readPid() {
  if (!(await fileExists(PID_FILE))) return null;
  const raw = await fs.readFile(PID_FILE, 'utf8');
  const pid = Number(raw.trim());
  return Number.isFinite(pid) ? pid : null;
}

function isPidRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function startDaemon() {
  await fs.mkdir(USER_CURSOR_DIR, { recursive: true });

  const existingPid = await readPid();
  if (existingPid && isPidRunning(existingPid)) {
    console.log(`MCP daemon already running (pid=${existingPid}) at ${MCP_DAEMON_URL}`);
    return;
  }

  const logHandle = await fs.open(LOG_FILE, 'a');
  const env = {
    ...process.env,
    MCP_HTTP_HOST: String(MCP_DAEMON_HOST),
    MCP_HTTP_PORT: String(MCP_DAEMON_PORT),
    MCP_HTTP_PATH: MCP_DAEMON_PATH,
    MCP_ALLOWED_PATHS: process.env.MCP_ALLOWED_PATHS || '*',
    MCP_DATA_DIR: process.env.MCP_DATA_DIR || path.join(USER_CURSOR_DIR, 'mcp-data'),
    OPEN_GRC_API_URL: process.env.OPEN_GRC_API_URL || 'http://localhost:3000',
    INTEGRATION_API_KEY: process.env.INTEGRATION_API_KEY || 'dev-integration-key',
  };

  const child = spawn(
    process.execPath,
    [path.join(ROOT, 'apps', 'mcp-server', 'src', 'index.mjs')],
    {
      cwd: ROOT,
      env,
      detached: true,
      stdio: ['ignore', logHandle.fd, logHandle.fd],
    },
  );
  child.unref();
  await logHandle.close();
  await fs.writeFile(PID_FILE, `${child.pid}\n`, 'utf8');
  console.log(`Started MCP daemon (pid=${child.pid}) at ${MCP_DAEMON_URL}`);
}

async function stopDaemon() {
  const pid = await readPid();
  if (!pid) {
    console.log('MCP daemon is not running.');
    return;
  }
  if (!isPidRunning(pid)) {
    await fs.rm(PID_FILE, { force: true });
    console.log('MCP daemon pid file was stale and has been cleaned up.');
    return;
  }
  try {
    process.kill(pid);
  } catch (err) {
    console.error(`Failed to stop MCP daemon pid=${pid}: ${err.message}`);
    process.exit(1);
  }
  await fs.rm(PID_FILE, { force: true });
  console.log(`Stopped MCP daemon pid=${pid}`);
}

async function statusDaemon() {
  const pid = await readPid();
  if (pid && isPidRunning(pid)) {
    console.log(`MCP daemon running pid=${pid} url=${MCP_DAEMON_URL}`);
    return;
  }
  console.log('MCP daemon not running');
  process.exitCode = 1;
}

async function main() {
  const cmd = process.argv[2] || 'status';
  if (cmd === 'start') return startDaemon();
  if (cmd === 'stop') return stopDaemon();
  if (cmd === 'status') return statusDaemon();
  console.error(`Unknown command: ${cmd}. Use start|stop|status.`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
