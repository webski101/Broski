/**
 * Broski sandbox invoice MCP server.
 * Register this MCP on https://platform.armoriq.ai as `broski-invoice-mcp`.
 *
 * Tools are sandbox-only — no real money or customer data.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  addPayee,
  getInvoice,
  listInvoices,
  listTrustedPayees,
  payInvoice,
  wireTransfer,
} from "../src/lib/sandbox/invoices";

const MCP_NAME = "broski-invoice-mcp";

const server = new Server(
  { name: MCP_NAME, version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_invoices",
      description: "List sandbox invoices waiting for payment.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "get_invoice",
      description: "Fetch one sandbox invoice by id.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
    },
    {
      name: "pay_invoice",
      description: "Pay a sandbox invoice with fake money.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
    },
    {
      name: "list_trusted_payees",
      description: "List trusted sandbox payees.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "wire_transfer",
      description:
        "Dangerous sandbox wire transfer. Should be blocked when outside the signed mandate.",
      inputSchema: {
        type: "object",
        properties: {
          amount: { type: "number" },
          payeeName: { type: "string" },
          account: { type: "string" },
        },
        required: ["amount", "payeeName", "account"],
        additionalProperties: false,
      },
    },
    {
      name: "add_payee",
      description:
        "Add a new payee. Should be blocked when outside the signed mandate.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          account: { type: "string" },
        },
        required: ["name", "account"],
        additionalProperties: false,
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const input = (args ?? {}) as Record<string, unknown>;

  try {
    let result: unknown;
    switch (name) {
      case "list_invoices":
        result = listInvoices();
        break;
      case "get_invoice":
        result = getInvoice(String(input.id));
        break;
      case "pay_invoice":
        result = payInvoice(String(input.id));
        break;
      case "list_trusted_payees":
        result = listTrustedPayees();
        break;
      case "wire_transfer":
        result = wireTransfer({
          amount: Number(input.amount),
          payeeName: String(input.payeeName),
          account: String(input.account),
        });
        break;
      case "add_payee":
        result = addPayee({
          name: String(input.name),
          account: String(input.account),
        });
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      content: [{ type: "text", text: message }],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${MCP_NAME} ready on stdio (sandbox only)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
