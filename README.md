# Broski

**Hire an AP agent with a signed job contract.** Broski turns a mandate into an ArmorIQ intent plan, then every MCP tool call is allow / hold / block for real.

Built for ArmorIQ **Flow State** — AI agents, MCP, and intent enforcement.

## What it does

1. You write a mandate (e.g. pay approved invoices under $500).
2. Broski signs that plan with ArmorIQ.
3. Sandbox MCP tools run only when ArmorIQ allows them.
4. Prompt-injection wires and unsigned invoices are **blocked by ArmorIQ**, not by a fake UI.

## Stack

- Next.js + TypeScript + Tailwind + shadcn/ui
- `@armoriq/sdk` for intent / policy enforcement
- `broski-invoice-mcp` — sandbox invoice MCP (`npm run mcp`)

## Setup

```bash
cp .env.example .env.local
# paste ARMORIQ_API_KEY from https://platform.armoriq.ai
npm install
```

On [platform.armoriq.ai](https://platform.armoriq.ai):

1. Create an API key
2. Onboard agent `broski-ap-agent`
3. Onboard MCP `broski-invoice-mcp`
4. Point policies at this agent (optional ArmorPay holds for over-limit pays)

## Run

```bash
# app UI
npm run dev
# → http://localhost:3847

# MCP server (stdio) — register this with ArmorIQ / your agent host
npm run mcp
```

## Demo script (2 minutes)

1. Open Broski → confirm ArmorIQ shows **connected**
2. Run **Full demo**
3. Show verdict feed:
   - `pay_invoice INV-120` → **ALLOW**
   - `wire_transfer $50k` → **BLOCK**
   - `pay_invoice INV-2400` → **BLOCK** (outside signed plan) or **HOLD** if ArmorPay policy is attached
4. Flash the ArmorIQ platform audit / plan view

## Rules alignment

| Rule | Broski |
| --- | --- |
| ArmorIQ required | All runs go through `@armoriq/sdk` session enforce |
| ≥1 MCP | `broski-invoice-mcp` |
| No real payments / customer data | Sandbox ledger only |
| No simulated enforcement | Without `ARMORIQ_API_KEY`, Broski refuses to invent verdicts |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js on port **3847** |
| `npm run mcp` | Invoice MCP over stdio |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
