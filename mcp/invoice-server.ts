/**
 * Broski sandbox invoice MCP server (stdio).
 * Register the remote HTTP twin on ArmorIQ as:
 *   name: broski-invoice-mcp
 *   url:  https://broskimcp.vercel.app/api/mcp
 *
 * Tools are sandbox-only — no real money or customer data.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  createInvoiceMcpServer,
  MCP_NAME,
} from "../src/lib/mcp/create-invoice-server";

async function main() {
  const server = createInvoiceMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${MCP_NAME} ready on stdio (sandbox only)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
