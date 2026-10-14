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
- `broski-invoice-mcp` — sandbox invoice MCP (HTTP + stdio)

## Setup

```bash
cp .env.example .env.local
# paste ARMORIQ_API_KEY from https://platform.armoriq.ai
npm install
```

On [platform.armoriq.ai](https://platform.armoriq.ai) → **Add MCP server**:

1. Method: **Remote endpoint**
2. Server name: `broski-invoice-mcp`
3. Server URL: `https://broskimcp.vercel.app/api/mcp`
4. Authentication: **None**
5. Continue → secure / scan

Also onboard agent `Broski` (`d7681f20-2ac7-49db-a8ae-7e1ede22f14b`).

## Run

```bash
# app UI
npm run dev
# → http://localhost:3847

# MCP over HTTP (same tools as production)
# → http://localhost:3847/api/mcp

# MCP over stdio (local agent hosts)
npm run mcp
```

Live MCP (Streamable HTTP): https://broskimcp.vercel.app/api/mcp

## Demo script (2 minutes)

1. Open Broski → confirm ArmorIQ shows **connected**
2. Click **Reset sandbox** if INV-120 shows paid (Full demo also auto-resets)
3. Run **Full demo**
4. Show verdict feed:
   - `pay_invoice INV-120` → **ALLOW**
   - `wire_transfer $50k` → **BLOCK**
   - `add_payee` → **BLOCK**
   - `pay_invoice INV-2400` → **BLOCK** (outside signed plan)
5. Flash the ArmorIQ platform audit / Policy Studio

### Vercel env vars (required)

| Variable | Value |
| --- | --- |
| `ARMORIQ_API_KEY` | `ak_live_…` from platform.armoriq.ai |
| `AGENT_ID` | `d7681f20-2ac7-49db-a8ae-7e1ede22f14b` |
| `USER_ID` | `broski-operator` |
| `CONTEXT_ID` | `broski-hackathon` |
| `ARMORIQ_ENV` | `production` |
| `ARMORIQ_SESSION_MODE` | `sdk` |
| `ARMORIQ_LOCAL_MCP_FALLBACK` | `1` (keep demo ALLOW when proxy invoke fails after intent pass) |

Optional: `PROXY_ENDPOINT`, `IAP_ENDPOINT`, `BACKEND_ENDPOINT` (defaults are production ArmorIQ).

**Policy Studio:** allow `pay_invoice`, `get_invoice`, `list_invoices`, `list_trusted_payees` for Broski (or Default Allow). Deny/omit `wire_transfer` and `add_payee`.

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
