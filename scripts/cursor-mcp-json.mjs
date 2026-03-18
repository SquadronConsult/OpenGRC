/* eslint-disable no-console */
import { spawnSync } from 'child_process';
import os from 'os';
import { getInstallDeepLink, getServerConfig, getWorkspaceMcpJson } from './cursor-mcp-common.mjs';

function tryCopyToClipboard(text) {
  const platform = os.platform();
  if (platform === 'win32') {
    // powershell clipboard is available on modern Windows.
    const r = spawnSync(
      'powershell',
      ['-NoProfile', '-Command', 'Set-Clipboard -Value @\'\n' + text + '\n\'@'],
      { stdio: 'ignore' },
    );
    return r.status === 0;
  }
  if (platform === 'darwin') {
    const r = spawnSync('pbcopy', [], { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
    return r.status === 0;
  }
  // Linux: common clipboard utility.
  const r = spawnSync('xclip', ['-selection', 'clipboard'], {
    input: text,
    stdio: ['pipe', 'ignore', 'ignore'],
  });
  return r.status === 0;
}

const mode = process.argv.includes('--server-only')
  ? 'server-only'
  : process.argv.includes('--global')
    ? 'global'
  : process.argv.includes('--workspace')
    ? 'workspace'
    : 'global';
const text = JSON.stringify(
  mode === 'server-only'
    ? getServerConfig(mode === 'workspace' ? 'workspace' : 'global')
    : getWorkspaceMcpJson(mode),
  null,
  2,
);
const deepLink = getInstallDeepLink(
  'open-grc-mcp',
  mode === 'workspace' ? 'workspace' : 'global',
);
const shouldCopy = process.argv.includes('--copy');
const openLink = process.argv.includes('--open');

if (mode === 'server-only') {
  console.log('\nPaste this into Cursor MCP "Add server JSON" dialog:\n');
} else if (mode === 'workspace') {
  console.log('\nPaste this into workspace `.cursor/mcp.json`:\n');
} else {
  console.log('\nPaste this into global `~/.cursor/mcp.json`:\n');
}
console.log(text);
console.log('');
console.log('Cursor one-click install link:\n');
console.log(deepLink);
console.log('');

if (shouldCopy) {
  const copied = tryCopyToClipboard(text);
  if (copied) {
    console.log('Copied MCP JSON to clipboard.');
  } else {
    console.log('Could not copy automatically. Please copy the JSON manually.');
  }
}

if (openLink) {
  let opened = false;
  const platform = os.platform();
  if (platform === 'win32') {
    const r = spawnSync('powershell', ['-NoProfile', '-Command', `Start-Process "${deepLink}"`], {
      stdio: 'ignore',
    });
    opened = r.status === 0;
  } else if (platform === 'darwin') {
    const r = spawnSync('open', [deepLink], { stdio: 'ignore' });
    opened = r.status === 0;
  } else {
    const r = spawnSync('xdg-open', [deepLink], { stdio: 'ignore' });
    opened = r.status === 0;
  }

  if (opened) {
    console.log('Opened Cursor MCP install deep link.');
  } else {
    console.log('Could not open deep link automatically. Paste the link into your browser.');
  }
}

