'use client';

import { useMemo, useState } from 'react';
import { Plug, Copy, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-semibold">Cursor MCP Connect</CardTitle>
        <Badge variant="secondary">In-app button</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Click to install the MCP server into Cursor directly. If Cursor blocks the
          protocol handler, use the copy buttons below.
        </p>
        <p className="text-xs text-muted-foreground/60">
          This installs a URL-based MCP entry (<code className="rounded bg-muted px-1 py-0.5 text-xs text-primary">http://127.0.0.1:3334/mcp</code>) in Cursor.
        </p>
        <p className="text-xs text-muted-foreground/60">
          Make sure the stack is running and the host daemon is up: <code className="rounded bg-muted px-1 py-0.5 text-xs text-primary">npm run mcp:daemon:start</code>.
          For global machine-wide setup, you can still run <code className="rounded bg-muted px-1 py-0.5 text-xs text-primary">npm run cursor:connect</code>.
        </p>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onInstall}>
            <Plug size={14} />
            Connect Cursor MCP
          </Button>
          <Button variant="outline" size="sm" onClick={onCopyLink}>
            <Copy size={14} />
            Copy Install Link
          </Button>
        </div>

        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
            Show/copy manual MCP JSON
          </summary>
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onCopyServer}>
                <Copy size={14} />
                Copy Server JSON
              </Button>
              <Button variant="outline" size="sm" onClick={onCopyWorkspace}>
                <Copy size={14} />
                Copy .cursor/mcp.json JSON
              </Button>
            </div>
            <p className="text-xs text-muted-foreground/60">
              Use server JSON in Cursor&apos;s &quot;Add MCP Server&quot; dialog. Use workspace JSON in
              <code className="ml-1 rounded bg-muted px-1 py-0.5 text-xs text-primary">.cursor/mcp.json</code>.
            </p>
            <pre className="overflow-x-auto rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">{serverJson}</pre>
          </div>
        </details>

        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
            Show one-click install deeplink
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-background p-3 text-xs text-muted-foreground break-all">{installLink}</pre>
        </details>

        {status && (
          <Alert>
            <AlertDescription className="text-sm">{status}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
