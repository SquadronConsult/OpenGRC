import path from 'path';

function parseList(value, fallback = []) {
  if (!value) return fallback;
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  workspaceRoot: path.resolve(process.env.MCP_WORKSPACE_ROOT || process.cwd()),
  allowedPaths: parseList(
    process.env.MCP_ALLOWED_PATHS,
    [path.resolve(process.env.MCP_WORKSPACE_ROOT || process.cwd())],
  ).map((p) => path.resolve(p)),
  allowAllPaths: parseList(process.env.MCP_ALLOWED_PATHS, []).includes('*'),
  dataDir: path.resolve(process.env.MCP_DATA_DIR || '/app/data'),
  maxFilesPerRun: Number(process.env.MCP_MAX_FILES_PER_RUN || 25),
  maxStepsPerRun: Number(process.env.MCP_MAX_STEPS_PER_RUN || 60),
  maxFileBytes: Number(process.env.MCP_MAX_FILE_BYTES || 1024 * 1024),
  commandTimeoutMs: Number(process.env.MCP_COMMAND_TIMEOUT_MS || 120000),
  opengrcApiUrl: process.env.OPEN_GRC_API_URL || 'http://api:3000',
  integrationApiKey: process.env.INTEGRATION_API_KEY || '',
  dryRunDefault: process.env.MCP_DRY_RUN_DEFAULT === 'true',
  httpHost: process.env.MCP_HTTP_HOST || '127.0.0.1',
  httpPort: Number(process.env.MCP_HTTP_PORT || 3334),
  httpPath: process.env.MCP_HTTP_PATH || '/mcp',
  allowedHosts: parseList(process.env.MCP_ALLOWED_HOSTS, []),
};
