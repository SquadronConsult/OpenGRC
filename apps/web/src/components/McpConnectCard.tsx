'use client';

import { useMemo, useState } from 'react';

const serverName = 'open-grc-mcp';
function buildServerConfig() {
  return {
    url: 'http://127.0.0.1:3334/mcp',
    headers: {},
  };
}

function buildInstallLink(config: Record<string, unknown>) {
  const configJson = JSON.stringify(config);
  const encoded = btoa(configJson);
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(serverName)}&config=${encodeURIComponent(encoded)}`;
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export default function McpConnectCard() {
  const [status, setStatus] = useState('');
  const serverOnlyConfig = useMemo(() => buildServerConfig(), []);
  const workspaceConfig = useMemo(
    () => ({
      mcpServers: {
        [serverName]: serverOnlyConfig,
      },
    }),
    [serverOnlyConfig],
  );
  const installLink = useMemo(() => buildInstallLink(serverOnlyConfig), [serverOnlyConfig]);
  const serverJson = useMemo(() => JSON.stringify(serverOnlyConfig, null, 2), [serverOnlyConfig]);
  const workspaceJson = useMemo(() => JSON.stringify(workspaceConfig, null, 2), [workspaceConfig]);

  const onInstall = () => {
    window.location.href = installLink;
    setStatus('Opened Cursor install prompt. Approve in Cursor if prompted.');
  };

  const onCopyServer = async () => {
    try {
      await copyText(serverJson);
      setStatus('Copied server JSON for Cursor "Add MCP Server" dialog.');
    } catch {
      setStatus('Copy failed. Select and copy the JSON manually.');
    }
  };

  const onCopyWorkspace = async () => {
    try {
      await copyText(workspaceJson);
      setStatus('Copied workspace .cursor/mcp.json JSON.');
    } catch {
      setStatus('Copy failed. Select and copy the JSON manually.');
    }
  };

  const onCopyLink = async () => {
    try {
      await copyText(installLink);
      setStatus('Copied one-click Cursor MCP install link.');
    } catch {
      setStatus('Copy failed. Select and copy the deeplink manually.');
    }
  };

  return (
    <section className="card" style={{ marginTop: '1.5rem' }}>
      <div className="card-header">
        <h3 style={{ margin: 0 }}>Cursor MCP Connect</h3>
        <span className="badge badge-blue">In-app button</span>
      </div>
      <p className="text-sm text-muted mb-2">
        Click to install the MCP server into Cursor directly. If Cursor blocks the
        protocol handler, use the copy buttons below.
      </p>
      <p className="text-xs text-dim mb-2">
        This installs a URL-based MCP entry (`http://127.0.0.1:3334/mcp`) in Cursor.
      </p>
      <p className="text-xs text-dim mb-2">
        Make sure the stack is running and the host daemon is up: <code>npm run mcp:daemon:start</code>.
        For global machine-wide setup, you can still run <code>npm run cursor:connect</code>.
      </p>

      <div className="btn-group mt-1">
        <button type="button" className="btn btn-primary" onClick={onInstall}>
          Connect Cursor MCP
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCopyLink}>
          Copy Install Link
        </button>
      </div>

      <details className="mt-2">
        <summary className="text-sm text-muted" style={{ cursor: 'pointer' }}>
          Show/copy manual MCP JSON
        </summary>
        <div className="btn-group mt-1">
          <button type="button" className="btn btn-secondary" onClick={onCopyServer}>
            Copy Server JSON
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCopyWorkspace}
          >
            Copy .cursor/mcp.json JSON
          </button>
        </div>
        <p className="text-xs text-dim mt-1">
          Use server JSON in Cursor's "Add MCP Server" dialog. Use workspace JSON in
          `.cursor/mcp.json`.
        </p>
        <pre className="code-block mt-1">{serverJson}</pre>
      </details>

      <details className="mt-1">
        <summary className="text-sm text-muted" style={{ cursor: 'pointer' }}>
          Show one-click install deeplink
        </summary>
        <pre className="code-block mt-1">{installLink}</pre>
      </details>

      {status && (
        <div className="alert alert-info mt-2" role="status">
          {status}
        </div>
      )}
    </section>
  );
}

