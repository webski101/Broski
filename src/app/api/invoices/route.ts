import { NextResponse } from "next/server";
import { listInvoices, resetSandbox } from "@/lib/sandbox/invoices";


export async function GET() {
  return NextResponse.json({ invoices: listInvoices() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { reset?: boolean };
  if (body.reset) {
    resetSandbox();
  }
  return NextResponse.json({ invoices: listInvoices() });
}
