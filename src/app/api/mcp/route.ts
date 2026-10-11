import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  createInvoiceMcpServer,
  MCP_NAME,
  MCP_VERSION,
} from "@/lib/mcp/create-invoice-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, mcp-session-id, Last-Event-ID, mcp-protocol-version",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
};

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

async function handleMcp(req: Request): Promise<Response> {
  // Stateless + JSON responses — works on Vercel serverless (no sticky SSE).
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createInvoiceMcpServer();
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(req);
    return withCors(response);
  } finally {
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Discovery / health for humans hitting the URL in a browser. */
export async function GET(req: Request) {
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/event-stream") || accept.includes("application/json")) {
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
