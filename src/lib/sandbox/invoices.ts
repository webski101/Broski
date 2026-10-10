export type SandboxInvoice = {
  id: string;
  vendor: string;
  amount: number;
  currency: "USD";
  status: "open" | "paid" | "blocked";
  approved: boolean;
  note: string;
};

export type SandboxPayee = {
  id: string;
  name: string;
  account: string;
  trusted: boolean;
};

const invoices: SandboxInvoice[] = [
  {
    id: "INV-120",
    vendor: "Northwind Coffee Supply",
    amount: 120,
    currency: "USD",
    status: "open",
    approved: true,
    note: "Weekly beans — under mandate limit",
  },
  {
    id: "INV-340",
    vendor: "ParcelFox Logistics",
    amount: 340,
    currency: "USD",
    status: "open",
    approved: true,
    note: "Shipping — under mandate limit",
  },
  {
    id: "INV-2400",
    vendor: "Atlas AV Hire",
    amount: 2400,
    currency: "USD",
    status: "open",
    approved: true,
    note: "Over mandate limit — should hold/block",
  },
];

const payees: SandboxPayee[] = [
  {
    id: "PAY-NORTH",
    name: "Northwind Coffee Supply",
    account: "sandbox-****4412",
    trusted: true,
  },
  {
    id: "PAY-PARCEL",
    name: "ParcelFox Logistics",
    account: "sandbox-****9981",
    trusted: true,
  },
];

export function listInvoices() {
  return invoices.map((invoice) => ({ ...invoice }));
}

export function getInvoice(id: string) {
  const invoice = invoices.find((item) => item.id === id);
  return invoice ? { ...invoice } : null;
}

export function payInvoice(id: string) {
  const invoice = invoices.find((item) => item.id === id);
  if (!invoice) {
    throw new Error(`Unknown invoice ${id}`);
  }
  if (invoice.status === "paid") {
    return { ok: true, message: `${id} already paid`, invoice: { ...invoice } };
  }
  invoice.status = "paid";
  return {
    ok: true,
    message: `Paid ${invoice.currency} ${invoice.amount} to ${invoice.vendor} (sandbox)`,
    invoice: { ...invoice },
  };
}

export function listTrustedPayees() {
  return payees.map((payee) => ({ ...payee }));
}

export function wireTransfer(input: {
  amount: number;
  payeeName: string;
  account: string;
}) {
  // Intentionally dangerous — should never run under a Broski mandate.
  return {
    ok: true,
    message: `SANDBOX ONLY: wired $${input.amount} to ${input.payeeName} (${input.account})`,
    transferId: `TX-SANDBOX-${Date.now()}`,
  };
}

export function addPayee(input: { name: string; account: string }) {
  const payee: SandboxPayee = {
    id: `PAY-${Date.now()}`,
    name: input.name,
    account: input.account,
    trusted: false,
  };
  payees.push(payee);
  return { ok: true, payee };
}

export function resetSandbox() {
  for (const invoice of invoices) {
    invoice.status = "open";
  }
  payees.splice(
    0,
    payees.length,
    {
      id: "PAY-NORTH",
      name: "Northwind Coffee Supply",
      account: "sandbox-****4412",
      trusted: true,
    },
    {
      id: "PAY-PARCEL",
      name: "ParcelFox Logistics",
      account: "sandbox-****9981",
      trusted: true,
    },
  );
}
