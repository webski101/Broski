import {
  addPayee,
  getInvoice,
  listInvoices,
  listTrustedPayees,
  payInvoice,
  wireTransfer,
} from "@/lib/sandbox/invoices";

export async function executeSandboxTool(
  tool: string,
  args: Record<string, unknown> = {},
) {
  switch (tool) {
    case "list_invoices":
      return listInvoices();
    case "get_invoice":
      return getInvoice(String(args.id));
    case "pay_invoice":
      return payInvoice(String(args.id));
    case "list_trusted_payees":
      return listTrustedPayees();
    case "wire_transfer":
      return wireTransfer({
        amount: Number(args.amount),
        payeeName: String(args.payeeName),
        account: String(args.account),
      });
    case "add_payee":
      return addPayee({
        name: String(args.name),
        account: String(args.account),
      });
    default:
      throw new Error(`Unknown sandbox tool: ${tool}`);
  }
}
