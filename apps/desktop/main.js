const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const { join } = require('path');
const { existsSync, mkdirSync } = require('fs');

let mainWindow = null;
let apiProc = null;
let webProc = null;

const API_PORT = '3000';
const WEB_PORT = '3001';

function rootDir() {
  return join(__dirname, '..', '..');
}

function spawnManaged(command, args, options) {
  const child = spawn(command, args, {
    shell: true,
    stdio: 'pipe',
    ...options,
  });
  child.stdout?.on('data', (d) => process.stdout.write(String(d)));
  child.stderr?.on('data', (d) => process.stderr.write(String(d)));
  return child;
}

function waitFor(url, timeoutMs = 45000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve();
      } catch {
        // keep polling
      }
      if (Date.now() - started > timeoutMs) {
        return reject(new Error(`Timed out waiting for ${url}`));
      }
      setTimeout(tick, 1000);
    };
    tick();
  });
}

async function startBackendAndFrontend() {
  const userDataDir = app.getPath('userData');
  const localDataDir = join(userDataDir, 'local-data');
  const evidenceDir = join(userDataDir, 'evidence');
  const frmrDataDir = join(userDataDir, 'data');
  if (!existsSync(localDataDir)) mkdirSync(localDataDir, { recursive: true });
  if (!existsSync(evidenceDir)) mkdirSync(evidenceDir, { recursive: true });
  if (!existsSync(frmrDataDir)) mkdirSync(frmrDataDir, { recursive: true });

  const apiCwd = join(rootDir(), 'apps', 'api');
  const webCwd = join(rootDir(), 'apps', 'web');

  apiProc = spawnManaged(
    'npm',
    ['run', 'start:prod'],
    {
      cwd: apiCwd,
      env: {
        ...process.env,
        PORT: API_PORT,
        DB_TYPE: 'sqlite',
        SQLITE_PATH: join(localDataDir, 'grc.sqlite'),
        EVIDENCE_DIR: evidenceDir,
        FRMR_PREFER_LOCAL: 'true',
        FRMR_OFFLINE_PATH: join(frmrDataDir, 'FRMR.documentation.json'),
        NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`,
        PUBLIC_API_URL: `http://localhost:${API_PORT}`,
      },
    },
  );

  webProc = spawnManaged(
    'npm',
    ['run', 'start'],
    {
      cwd: webCwd,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`,
        PUBLIC_API_URL: `http://localhost:${API_PORT}`,
      },
    },
  );

  await waitFor(`http://localhost:${API_PORT}/health`);
  await waitFor(`http://localhost:${WEB_PORT}`);
}

async function createWindow() {
  await startBackendAndFrontend();
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });

  await mainWindow.loadURL(`http://localhost:${WEB_PORT}`);
}

function stopChildren() {
  if (webProc && !webProc.killed) webProc.kill();
  if (apiProc && !apiProc.killed) apiProc.kill();
}

app.on('window-all-closed', () => {
  stopChildren();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', stopChildren);

app.whenReady().then(() => {
  createWindow().catch((err) => {
    dialog.showErrorBox('OpenGRC Desktop failed to start', String(err));
    stopChildren();
    app.exit(1);
  });
});
