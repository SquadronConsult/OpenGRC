import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT = path.resolve(__dirname, '..');
export const USER_CURSOR_DIR = path.join(os.homedir(), '.cursor');
export const MCP_DAEMON_HOST = process.env.MCP_HTTP_HOST || '127.0.0.1';
export const MCP_DAEMON_PORT = Number(process.env.MCP_HTTP_PORT || 3334);
export const MCP_DAEMON_PATH = process.env.MCP_HTTP_PATH || '/mcp';
export const MCP_DAEMON_URL = `http://${MCP_DAEMON_HOST}:${MCP_DAEMON_PORT}${MCP_DAEMON_PATH}`;

export function getServerConfig(mode = 'global') {
  return {
    url: MCP_DAEMON_URL,
    headers: {},
  };
}

export function getWorkspaceMcpJson(mode = 'global') {
  return {
    mcpServers: {
      'open-grc-mcp': getServerConfig(mode),
    },
  };
}

export function getInstallDeepLink(serverName = 'open-grc-mcp', mode = 'global') {
  const encoded = Buffer.from(JSON.stringify(getServerConfig(mode)), 'utf8').toString(
    'base64',
  );
  const name = encodeURIComponent(serverName);
  const config = encodeURIComponent(encoded);
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${name}&config=${config}`;
}

