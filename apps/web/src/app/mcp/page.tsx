import { Plug } from 'lucide-react';
import McpConnectCard from '@/components/McpConnectCard';

export default function McpConnectPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-foreground">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Plug className="h-5 w-5" aria-hidden />
          </span>
          MCP Connect
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Connect Cursor (or any MCP-compatible client) to the OpenGRC MCP HTTP endpoint so agents
          can call compliance tools: project context, gap analysis, FRMR taxonomy, evidence workflows,
          and OSCAL outputs. Run the host daemon and install the server using the card below.
        </p>
        <p className="text-xs text-muted-foreground/80">
          Full tool list and environment variables:{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-[0.7rem]">docs/MCP_SERVER.md</code> in the
          repository.
        </p>
      </div>

      <McpConnectCard />
    </div>
  );
}
