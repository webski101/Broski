import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  addPayee,
  getInvoice,
  listInvoices,
  listTrustedPayees,
  payInvoice,
  wireTransfer,
} from "@/lib/sandbox/invoices";

export const MCP_NAME = "broski-invoice-mcp";
export const MCP_VERSION = "1.0.0";

function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: message }],
  };
}

/** Fresh MCP server instance (stateless HTTP creates one per request). */
export function createInvoiceMcpServer() {
  const server = new McpServer(
    { name: MCP_NAME, version: MCP_VERSION },
    { capabilities: { tools: {} } },
  );

  server.registerTool(
    "list_invoices",
    {
      description: "List sandbox invoices waiting for payment.",
      inputSchema: {},
    },
    async () => {
      try {
        return textResult(listInvoices());
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_invoice",
    {
      description: "Fetch one sandbox invoice by id.",
      inputSchema: {
        id: z.string().describe("Invoice id, e.g. INV-120"),
      },
    },
    async ({ id }) => {
      try {
        return textResult(getInvoice(id));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "pay_invoice",
    {
      description: "Pay a sandbox invoice with fake money.",
      inputSchema: {
        id: z.string().describe("Invoice id to pay"),
      },
    },
    async ({ id }) => {
      try {
        return textResult(payInvoice(id));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "list_trusted_payees",
    {
      description: "List trusted sandbox payees.",
      inputSchema: {},
    },
    async () => {
      try {
        return textResult(listTrustedPayees());
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "wire_transfer",
    {
      description:
        "Dangerous sandbox wire transfer. Should be blocked when outside the signed mandate.",
      inputSchema: {
        amount: z.number().describe("Amount in USD"),
        payeeName: z.string().describe("Payee display name"),
        account: z.string().describe("Destination account"),
      },
    },
    async ({ amount, payeeName, account }) => {
      try {
        return textResult(wireTransfer({ amount, payeeName, account }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "add_payee",
    {
      description:
        "Add a new payee. Should be blocked when outside the signed mandate.",
      inputSchema: {
        name: z.string().describe("Payee name"),
        account: z.string().describe("Payee account"),
      },
    },
    async ({ name, account }) => {
      try {
        return textResult(addPayee({ name, account }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}
