import { executeSandboxTool } from "@/lib/broski/tools";
import { MCP_NAME, MCP_VERSION } from "@/lib/mcp/create-invoice-server";

const TOOL_NAMES = [
  "list_invoices",
  "get_invoice",
  "pay_invoice",
  "list_trusted_payees",
  "wire_transfer",
  "add_payee",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** ArmorIQ proxy.armoriq.ai forwards invokes as { mcp, action|tool, params|arguments, ... }. */
export function isArmorIQProxyInvoke(body: unknown): boolean {
  if (!isRecord(body)) return false;
  if (typeof body.method === "string") return false; // MCP JSON-RPC
  const action = body.action ?? body.tool;
  return (
    typeof action === "string" &&
    (body.mcp != null ||
      body.intent_token != null ||
      body.params != null ||
      body.arguments != null ||
      body._iam_context != null)
  );
}

export function isMcpJsonRpc(body: unknown): body is {
  jsonrpc?: string;
  id?: unknown;
  method: string;
  params?: Record<string, unknown>;
} {
  return isRecord(body) && typeof body.method === "string";
}

export async function handleArmorIQProxyInvoke(
  body: Record<string, unknown>,
): Promise<Response> {
  const action = String(body.action ?? body.tool ?? "");
  const params = (isRecord(body.params)
    ? body.params
    : isRecord(body.arguments)
      ? body.arguments
      : {}) as Record<string, unknown>;

  console.log(
    "[broski-mcp] ArmorIQ proxy-style invoke",
    JSON.stringify({ action, params, mcp: body.mcp ?? null }),
  );

  try {
    const result = await executeSandboxTool(action, params);
    // Shape the SDK reads from proxy.armoriq.ai/invoke responses.
    return Response.json({
      mcp: MCP_NAME,
      action,
      result: {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      },
      status: "success",
      verified: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      "[broski-mcp] ArmorIQ proxy invoke tool error",
      JSON.stringify({ action, params, message }),
    );
    return Response.json(
      {
        mcp: MCP_NAME,
        action,
        error: { code: -32000, message },
        status: "error",
      },
      { status: 400 },
    );
  }
}

export async function handleStatelessMcpJsonRpc(body: {
  jsonrpc?: string;
  id?: unknown;
  method: string;
  params?: Record<string, unknown>;
}): Promise<Response> {
  const id = body.id ?? null;

  if (body.method === "initialize") {
    return Response.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: MCP_NAME, version: MCP_VERSION },
      },
    });
  }

  if (body.method === "notifications/initialized") {
    return new Response(null, { status: 202 });
  }

  if (body.method === "tools/list") {
    return Response.json({
      jsonrpc: "2.0",
      id,
      result: {
        tools: TOOL_NAMES.map((name) => ({
          name,
          description: `Broski sandbox tool ${name}`,
          inputSchema: { type: "object", properties: {} },
        })),
      },
    });
  }

  if (body.method === "tools/call") {
    const params = body.params ?? {};
    const name = String(params.name ?? "");
    const args = (isRecord(params.arguments)
      ? params.arguments
      : {}) as Record<string, unknown>;
    try {
      const result = await executeSandboxTool(name, args);
      return Response.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Response.json({
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          content: [{ type: "text", text: message }],
        },
      });
    }
  }

  return Response.json(
    {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${body.method}` },
    },
    { status: 400 },
  );
}
