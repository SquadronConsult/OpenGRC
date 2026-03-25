import { randomUUID } from 'crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  isInitializeRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { config, MCP_PROTOCOL_VERSION } from './config.mjs';
import { tools, dispatchTool } from './tool-registry.mjs';
import { errorResult } from './helpers.mjs';

const transportBySessionId = new Map();

function createProtocolServer() {
  const server = new Server(
    {
      name: 'open-grc-mcp',
      version: MCP_PROTOCOL_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request?.params?.name;
    const args = request?.params?.arguments || {};

    try {
      const out = await dispatchTool(name, args);
      if (out != null) return out;
      return errorResult(`Unknown tool: ${name}`);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  });

  return server;
}

function sendJsonRpcError(res, statusCode, message, id = null) {
  if (res.headersSent) return;
  res.status(statusCode).json({
    jsonrpc: '2.0',
    error: { code: -32000, message },
    id,
  });
}

const app = createMcpExpressApp({
  host: config.httpHost,
  ...(config.allowedHosts.length ? { allowedHosts: config.allowedHosts } : {}),
});
app.disable('x-powered-by');

app.post(config.httpPath, async (req, res) => {
  const body = req.body;
  const existingSessionId = req.headers['mcp-session-id'];
  const sessionId =
    typeof existingSessionId === 'string'
      ? existingSessionId
      : Array.isArray(existingSessionId)
        ? existingSessionId[0]
        : undefined;

  let session = sessionId ? transportBySessionId.get(sessionId) : undefined;

  if (!session) {
    if (!isInitializeRequest(body)) {
      return sendJsonRpcError(
        res,
        400,
        'No active MCP session. Send initialize request first.',
        body?.id ?? null,
      );
    }
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });
    const srv = createProtocolServer();
    await srv.connect(transport);
    transport.onclose = async () => {
      if (transport.sessionId) {
        transportBySessionId.delete(transport.sessionId);
      }
      await srv.close();
    };
    session = { server: srv, transport };
  }

  await session.transport.handleRequest(req, res, body);

  if (session.transport.sessionId) {
    transportBySessionId.set(session.transport.sessionId, session);
  }
});

app.get(config.httpPath, async (req, res) => {
  const existingSessionId = req.headers['mcp-session-id'];
  const sessionId =
    typeof existingSessionId === 'string'
      ? existingSessionId
      : Array.isArray(existingSessionId)
        ? existingSessionId[0]
        : undefined;
  const session = sessionId ? transportBySessionId.get(sessionId) : undefined;
  if (!session) {
    return sendJsonRpcError(res, 400, 'Missing or invalid MCP session id.');
  }
  await session.transport.handleRequest(req, res);
});

app.delete(config.httpPath, async (req, res) => {
  const existingSessionId = req.headers['mcp-session-id'];
  const sessionId =
    typeof existingSessionId === 'string'
      ? existingSessionId
      : Array.isArray(existingSessionId)
        ? existingSessionId[0]
        : undefined;
  const session = sessionId ? transportBySessionId.get(sessionId) : undefined;
  if (!session) {
    return sendJsonRpcError(res, 400, 'Missing or invalid MCP session id.');
  }
  await session.transport.handleRequest(req, res);
});

const server = app.listen(config.httpPort, config.httpHost, () => {
  console.log(
    `open-grc-mcp listening on http://${config.httpHost}:${config.httpPort}${config.httpPath}`,
  );
});

async function shutdown() {
  for (const [sessionId, session] of transportBySessionId.entries()) {
    try {
      await session.transport.close();
      await session.server.close();
    } catch {
      // ignore teardown issues on shutdown
    } finally {
      transportBySessionId.delete(sessionId);
    }
  }
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
