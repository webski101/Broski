"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_MANDATE } from "@/lib/broski/mandate";
import type {
  MandateConfig,
  RunResponse,
  ScenarioId,
  VerdictEvent,
} from "@/lib/broski/types";
import type { SandboxInvoice } from "@/lib/sandbox/invoices";

type StatusPayload = {
  configured: boolean;
  agentId: string;
  mcp: string;
  platform: string;
  invoices: SandboxInvoice[];
};

const SCENARIOS: Array<{ id: ScenarioId; title: string; blurb: string }> = [
  {
    id: "full_demo",
    title: "Full demo",
    blurb: "ALLOW → BLOCK injection → BLOCK over-limit",
  },
  {
    id: "pay_under_limit",
    title: "Pay under limit",
    blurb: "Happy path inside the signed mandate",
  },
  {
    id: "prompt_injection_wire",
    title: "Injection attack",
    blurb: "Try a $50k wire outside intent",
  },
  {
    id: "over_limit_invoice",
    title: "Over-limit invoice",
    blurb: "Pay INV-2400 which was never signed",
  },
];

function verdictTone(action: VerdictEvent["action"]) {
  switch (action) {
    case "allow":
      return "border-[var(--broski-allow)]/40 bg-[var(--broski-allow)]/10 text-[var(--broski-allow)]";
    case "block":
      return "border-[var(--broski-block)]/40 bg-[var(--broski-block)]/10 text-[var(--broski-block)]";
    case "hold":
      return "border-[var(--broski-hold)]/40 bg-[var(--broski-hold)]/10 text-[var(--broski-hold)]";
    default:
      return "border-white/20 bg-white/5 text-white/70";
  }
}

export function BroskiApp() {
  const [mandate, setMandate] = useState<MandateConfig>(DEFAULT_MANDATE);
  const [scenario, setScenario] = useState<ScenarioId>("full_demo");
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [run, setRun] = useState<RunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/status")
      .then((res) => res.json())
      .then((data: StatusPayload) => setStatus(data))
      .catch(() =>
        setStatus({
          configured: false,
          agentId: "broski-ap-agent",
          mcp: "broski-invoice-mcp",
          platform: "https://platform.armoriq.ai",
          invoices: [],
        }),
      );
  }, []);

  function updateMandate<K extends keyof MandateConfig>(
    key: K,
    value: MandateConfig[K],
  ) {
    setMandate((prev) => ({ ...prev, [key]: value }));
  }

  function runScenario() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario, mandate, reset: true }),
        });
        const data = (await res.json()) as RunResponse & { error?: string };
        if (!res.ok) {
          setError(data.error || "Run failed");
          return;
        }
        setRun(data);
        const statusRes = await fetch("/api/status");
        setStatus(await statusRes.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const invoices = status?.invoices ?? [];

  return (
    <div className="broski-shell relative min-h-screen overflow-hidden">
      <div className="broski-grid pointer-events-none absolute inset-0" />
      <div className="broski-orb pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full blur-3xl" />
      <div className="broski-orb-2 pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full blur-3xl" />

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 pb-16 pt-8 md:px-8 md:pt-12">
        <header className="broski-rise flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="font-[family-name:var(--font-broski-mono)] text-xs uppercase tracking-[0.35em] text-[var(--broski-mint)]">
              Flow State · ArmorIQ
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-broski-display)] text-5xl font-bold tracking-tight text-[var(--broski-ink)] md:text-7xl">
              Broski
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--broski-muted)] md:text-lg">
              Hire an AP agent with a signed job contract. ArmorIQ enforces the
              mandate on every MCP call — allow, hold, or block for real.
            </p>
          </div>
          <div className="broski-panel flex flex-col gap-2 p-4 font-[family-name:var(--font-broski-mono)] text-xs text-[var(--broski-muted)]">
            <div className="flex items-center justify-between gap-6">
              <span>ArmorIQ</span>
              <Badge
                variant="outline"
                className={
                  status?.configured
                    ? "border-[var(--broski-allow)]/50 text-[var(--broski-allow)]"
                    : "border-[var(--broski-hold)]/50 text-[var(--broski-hold)]"
                }
              >
                {status?.configured ? "connected" : "needs API key"}
              </Badge>
            </div>
            <div className="flex justify-between gap-6">
              <span>agent</span>
              <span className="text-[var(--broski-ink)]">
                {status?.agentId ?? "broski-ap-agent"}
              </span>
            </div>
            <div className="flex justify-between gap-6">
              <span>mcp</span>
              <span className="text-[var(--broski-ink)]">
                {status?.mcp ?? "broski-invoice-mcp"}
              </span>
            </div>
          </div>
        </header>

        {!status?.configured && (
          <div className="broski-rise broski-panel border-[var(--broski-hold)]/30 p-4 text-sm text-[var(--broski-muted)]">
            Set <code className="text-[var(--broski-mint)]">ARMORIQ_API_KEY</code>{" "}
            from{" "}
            <a
              className="underline decoration-[var(--broski-mint)]/50 underline-offset-4"
              href="https://platform.armoriq.ai"
              target="_blank"
              rel="noreferrer"
            >
              platform.armoriq.ai
            </a>
            , onboard agent <code className="text-[var(--broski-ink)]">broski-ap-agent</code>{" "}
            and MCP <code className="text-[var(--broski-ink)]">broski-invoice-mcp</code>.
            Broski never fakes enforcement.
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="broski-rise broski-panel flex flex-col gap-5 p-5 md:p-6">
            <div>
              <h2 className="font-[family-name:var(--font-broski-display)] text-2xl text-[var(--broski-ink)]">
                Mandate
              </h2>
              <p className="mt-1 text-sm text-[var(--broski-muted)]">
                This becomes the signed ArmorIQ intent plan.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={mandate.title}
                  onChange={(e) => updateMandate("title", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="goal">Goal / contract</Label>
                <Textarea
                  id="goal"
                  rows={3}
                  value={mandate.goal}
                  onChange={(e) => updateMandate("goal", e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="max">Max amount (USD)</Label>
                  <Input
                    id="max"
                    type="number"
                    value={mandate.maxAmount}
                    onChange={(e) =>
                      updateMandate("maxAmount", Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Operator email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={mandate.userEmail}
                    onChange={(e) => updateMandate("userEmail", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ids">Allowed invoice IDs</Label>
                <Input
                  id="ids"
                  value={mandate.allowedInvoiceIds.join(", ")}
                  onChange={(e) =>
                    updateMandate(
                      "allowedInvoiceIds",
                      e.target.value
                        .split(",")
                        .map((part) => part.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </div>
            </div>

            <div className="grid gap-3">
              <p className="font-[family-name:var(--font-broski-mono)] text-xs uppercase tracking-[0.2em] text-[var(--broski-muted)]">
                Scenario
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SCENARIOS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setScenario(item.id)}
                    className={`rounded-xl border px-3 py-3 text-left transition ${
                      scenario === item.id
                        ? "border-[var(--broski-mint)] bg-[var(--broski-mint)]/10"
                        : "border-white/10 bg-black/20 hover:border-white/25"
                    }`}
                  >
                    <div className="text-sm font-medium text-[var(--broski-ink)]">
                      {item.title}
                    </div>
                    <div className="mt-1 text-xs text-[var(--broski-muted)]">
                      {item.blurb}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Button
              size="lg"
              className="broski-cta h-12 w-full text-base font-semibold"
              onClick={runScenario}
              disabled={pending}
            >
              {pending ? "Enforcing mandate…" : "Run Broski with ArmorIQ"}
            </Button>
            {error && (
              <p className="text-sm text-[var(--broski-block)]">{error}</p>
            )}
            {run && !run.configured && run.message && (
              <p className="text-sm text-[var(--broski-hold)]">{run.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <div className="broski-rise broski-panel p-5 md:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-[family-name:var(--font-broski-display)] text-2xl text-[var(--broski-ink)]">
                  Sandbox ledger
                </h2>
                <Badge variant="outline" className="border-white/15 text-[var(--broski-muted)]">
                  fake money only
                </Badge>
              </div>
              <div className="space-y-3">
                {invoices.map((invoice, index) => (
                  <div
                    key={invoice.id}
                    className="broski-invoice flex items-center justify-between gap-3 border-b border-white/8 py-3"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <div>
                      <div className="font-[family-name:var(--font-broski-mono)] text-sm text-[var(--broski-ink)]">
                        {invoice.id}
                      </div>
                      <div className="text-xs text-[var(--broski-muted)]">
                        {invoice.vendor}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-[family-name:var(--font-broski-mono)] text-sm text-[var(--broski-ink)]">
                        ${invoice.amount}
                      </div>
                      <div
                        className={`text-xs uppercase tracking-wider ${
                          invoice.status === "paid"
                            ? "text-[var(--broski-allow)]"
                            : "text-[var(--broski-muted)]"
                        }`}
                      >
                        {invoice.status}
                      </div>
                    </div>
                  </div>
                ))}
                {invoices.length === 0 && (
                  <p className="text-sm text-[var(--broski-muted)]">
                    Loading sandbox invoices…
                  </p>
                )}
              </div>
            </div>

            <div className="broski-rise broski-panel flex min-h-[320px] flex-1 flex-col p-5 md:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-[family-name:var(--font-broski-display)] text-2xl text-[var(--broski-ink)]">
                  Verdict feed
                </h2>
                {run?.enforcementMode && (
                  <Badge
                    variant="outline"
                    className="border-[var(--broski-mint)]/40 text-[var(--broski-mint)]"
                  >
                    mode:{run.enforcementMode}
                  </Badge>
                )}
              </div>
              <ScrollArea className="h-[340px] pr-3">
                <div className="space-y-3">
                  {(run?.events ?? []).map((event, index) => (
                    <article
                      key={event.id}
                      className={`broski-verdict rounded-xl border p-3 ${verdictTone(event.action)}`}
                      style={{ animationDelay: `${index * 90}ms` }}
                    >
                      <div className="flex items-center justify-between gap-3 font-[family-name:var(--font-broski-mono)] text-[10px] uppercase tracking-[0.18em]">
                        <span>{event.action}</span>
                        <span className="opacity-70">{event.tool}</span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--broski-ink)]">
                        {event.label}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed opacity-80">
                        {event.reason}
                      </p>
                    </article>
                  ))}
                  {!run?.events?.length && (
                    <div className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-[var(--broski-muted)]">
                      Run a scenario. Allowed pays show ALLOW. Injection wires and
                      unsigned invoices show BLOCK from ArmorIQ.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </section>

        {run?.planSteps?.length ? (
          <section className="broski-rise broski-panel p-5 md:p-6">
            <h2 className="font-[family-name:var(--font-broski-display)] text-xl text-[var(--broski-ink)]">
              Signed plan steps
            </h2>
            <p className="mt-1 text-sm text-[var(--broski-muted)]">{run.planGoal}</p>
            <ol className="mt-4 grid gap-2 font-[family-name:var(--font-broski-mono)] text-xs text-[var(--broski-muted)] md:grid-cols-2">
              {run.planSteps.map((step, index) => (
                <li
                  key={`${step.tool}-${index}`}
                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                >
                  <span className="text-[var(--broski-mint)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>{" "}
                  {step.tool} {JSON.stringify(step.args)}
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </main>
    </div>
  );
}
