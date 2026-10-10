import { NextResponse } from "next/server";
import { getArmorIQStatus } from "@/lib/armoriq";
import { listInvoices } from "@/lib/sandbox/invoices";


export async function GET() {
  return NextResponse.json({
    ...getArmorIQStatus(),
    invoices: listInvoices(),
    product: "Broski",
  });
}
