import { randomUUID } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  createInvoiceMcpServer,
  MCP_NAME,
  MCP_VERSION,
} from "@/lib/mcp/create-invoice-server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, mcp-session-id, Last-Event-ID, mcp-protocol-version",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
};

type Session = {
  transport: WebStandardStreamableHTTPServerTransport;
  server: McpServer;
  lastActive: number;
};

/** Best-effort in-memory sessions for ArmorIQ connect checks on a warm instance. */
const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 30 * 60 * 1000;

function pruneSessions() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, session] of sessions) {
    if (session.lastActive < cutoff) {
      sessions.delete(id);
      void session.transport.close().catch(() => undefined);
      void session.server.close().catch(() => undefined);
    }
  }
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function parseBody(req: Request): Promise<unknown> {
  const text = await req.text();
  if (!text) return undefined;
  return JSON.parse(text) as unknown;
}

function looksLikeInitialize(body: unknown): boolean {
  if (!body) return false;
  if (Array.isArray(body)) return body.some((msg) => isInitializeRequest(msg));
  return isInitializeRequest(body);
}

async function handleMcp(req: Request): Promise<Response> {
  pruneSessions();

  const sessionHeader = req.headers.get("mcp-session-id");
  let body: unknown;
  try {
    if (req.method === "POST") {
      body = await parseBody(req);
    }
  } catch {
    return withCors(
      Response.json(
        {
          jsonrpc: "2.0",
          error: { code: -32700, message: "Parse error: Invalid JSON" },
          id: null,
        },
        { status: 400 },
      ),
    );
  }

  let session = sessionHeader ? sessions.get(sessionHeader) : undefined;

  if (session) {
    session.lastActive = Date.now();
    const response = await session.transport.handleRequest(req, {
      parsedBody: body,
    });
    return withCors(response);
  }

  if (sessionHeader) {
    return withCors(
      Response.json(
        {
          jsonrpc: "2.0",
          error: { code: -32001, message: "Session not found" },
          id: null,
        },
        { status: 404 },
      ),
    );
  }

  if (req.method === "POST" && looksLikeInitialize(body)) {
    const server = createInvoiceMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (sessionId) => {
        sessions.set(sessionId, {
          transport,
          server,
          lastActive: Date.now(),
        });
      },
    });
    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) sessions.delete(sid);
    };
    await server.connect(transport);
    const response = await transport.handleRequest(req, { parsedBody: body });
    return withCors(response);
  }

  return withCors(
    Response.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      },
      { status: 400 },
    ),
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Discovery / health for humans hitting the URL in a browser. */
export async function GET(req: Request) {
  const accept = req.headers.get("accept") ?? "";
  if (
    accept.includes("text/event-stream") ||
    req.headers.get("mcp-session-id")
  ) {
    return handleMcp(req);
  }

  return Response.json(
    {
      name: MCP_NAME,
      version: MCP_VERSION,
      transport: "streamable-http",
      auth: "none",
      note: "POST JSON-RPC (MCP Streamable HTTP) to this endpoint. Sandbox invoices only.",
      tools: [
        "list_invoices",
        "get_invoice",
        "pay_invoice",
        "list_trusted_payees",
        "wire_transfer",
        "add_payee",
      ],
    },
    { headers: CORS_HEADERS },
  );
}

export async function POST(req: Request) {
  return handleMcp(req);
}

export async function DELETE(req: Request) {
  return handleMcp(req);
}
