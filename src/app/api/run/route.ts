import { NextResponse } from "next/server";
import { z } from "zod";
import { runBroskiScenario } from "@/lib/broski/agent";
import { DEFAULT_MANDATE } from "@/lib/broski/mandate";


const bodySchema = z.object({
  scenario: z
    .enum([
      "pay_under_limit",
      "prompt_injection_wire",
      "over_limit_invoice",
      "full_demo",
    ])
    .default("full_demo"),
  reset: z.boolean().optional(),
  mandate: z
    .object({
      title: z.string().min(1),
      goal: z.string().min(1),
      maxAmount: z.number().positive(),
      allowedInvoiceIds: z.array(z.string()).min(1),
      userEmail: z.string().email(),
      allowNewPayees: z.boolean(),
      allowWires: z.boolean(),
    })
    .optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const body = bodySchema.parse(json);
    const result = await runBroskiScenario({
      mandate: body.mandate ?? DEFAULT_MANDATE,
      scenario: body.scenario,
      reset: body.reset,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
