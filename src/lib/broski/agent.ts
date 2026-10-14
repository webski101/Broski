import { randomUUID } from "crypto";
import {
  IntentMismatchException,
  InvalidTokenException,
  MCPInvocationException,
  PolicyBlockedException,
  PolicyHoldException,
  type IntentToken,
} from "@armoriq/sdk";
import {
  BROSKI_MCP,
  createArmorIQClient,
  isArmorIQConfigured,
} from "@/lib/armoriq";
import { listInvoices, resetSandbox } from "@/lib/sandbox/invoices";
import { buildMandatePlanSteps, scenarioSteps } from "./mandate";
import { executeSandboxTool } from "./tools";
import type {
  MandateConfig,
  RunResponse,
  RunStepRequest,
  ScenarioId,
  VerdictEvent,
} from "./types";

function eventBase(
  step: RunStepRequest,
  action: VerdictEvent["action"],
  reason: string,
  result?: unknown,
): VerdictEvent {
  return {
    id: randomUUID(),
    at: new Date().toISOString(),
    label: step.label,
    tool: step.tool,
    args: step.args ?? {},
    action,
    reason,
    source: "armoriq",
    result,
  };
}

function planAllowsCall(
  planSteps: Array<{ tool: string; args: Record<string, unknown> }>,
  tool: string,
  args: Record<string, unknown>,
) {
  return planSteps.some((step) => {
    if (step.tool !== tool) return false;
    const declared = step.args ?? {};
    const declaredKeys = Object.keys(declared);
    if (declaredKeys.length === 0) return true;
    return declaredKeys.every(
      (key) => JSON.stringify(declared[key]) === JSON.stringify(args[key]),
    );
  });
}

function errorName(error: unknown): string {
  if (error && typeof error === "object" && "name" in error) {
    return String((error as { name?: string }).name || "");
  }
  return "";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isPolicyBlockedError(error: unknown): boolean {
  if (error instanceof PolicyBlockedException) return true;
  if (errorName(error) === "PolicyBlockedException") return true;
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("not allowed by policy") ||
    message.includes("blocked by policy") ||
    message.includes("policy blocked")
  );
}

function isPolicyHoldError(error: unknown): boolean {
  if (error instanceof PolicyHoldException) return true;
  return errorName(error) === "PolicyHoldException";
}

function formatProxyFailure(error: unknown): string {
  if (error instanceof MCPInvocationException) {
    const status =
      typeof error.statusCode === "number" ? ` status=${error.statusCode}` : "";
    return `MCPInvocationException${status}: ${error.message}`;
  }
  const name = errorName(error);
  const status =
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof (error as { statusCode?: unknown }).statusCode === "number"
      ? ` status=${(error as { statusCode: number }).statusCode}`
      : "";
  return `${name || "Error"}${status}: ${errorMessage(error)}`;
}

function mapArmorIQError(step: RunStepRequest, error: unknown): VerdictEvent {
  if (error instanceof IntentMismatchException) {
    return eventBase(
      step,
      "block",
      error.message ||
        `ArmorIQ intent mismatch: ${step.tool} is outside the signed Broski mandate.`,
    );
  }
  if (isPolicyBlockedError(error)) {
    return eventBase(
      step,
      "block",
      error instanceof PolicyBlockedException
        ? error.reason || error.message
        : errorMessage(error) || "ArmorIQ policy blocked this action.",
    );
  }
  if (isPolicyHoldError(error)) {
    return eventBase(
      step,
      "hold",
      errorMessage(error) || "ArmorIQ held this action for approval.",
      error instanceof PolicyHoldException
        ? error.delegationContext
        : undefined,
    );
  }
  if (error instanceof InvalidTokenException) {
    return eventBase(step, "error", error.message);
  }
  if (error instanceof MCPInvocationException) {
    return eventBase(
      step,
      "error",
      error.message || "ArmorIQ MCP invocation failed.",
    );
  }
  return eventBase(step, "error", errorMessage(error));
}

async function runStepThroughArmorIQ(input: {
  client: ReturnType<typeof createArmorIQClient>;
  token: IntentToken;
  step: RunStepRequest;
  planSteps: Array<{ tool: string; args: Record<string, unknown> }>;
  userEmail: string;
}): Promise<VerdictEvent> {
  const { client, token, step, planSteps, userEmail } = input;
  const args = step.args ?? {};

  try {
    const result = await client.invoke(
      BROSKI_MCP,
      step.tool,
      token,
      args,
      undefined,
      userEmail,
    );
    return eventBase(
      step,
      "allow",
      "ArmorIQ verified the signed intent and completed the MCP invoke via proxy.",
      result,
    );
  } catch (error) {
    if (error instanceof IntentMismatchException) {
      return eventBase(
        step,
        "block",
        error.message ||
          `ArmorIQ blocked ${step.tool} — outside the signed Broski mandate.`,
      );
    }

    if (isPolicyBlockedError(error)) {
      return eventBase(
        step,
        "block",
        error instanceof PolicyBlockedException
          ? error.reason || error.message
          : errorMessage(error) || "ArmorIQ policy blocked this action.",
      );
    }

    if (isPolicyHoldError(error)) {
      return eventBase(
        step,
        "hold",
        errorMessage(error) || "ArmorIQ held this action for human approval.",
        error instanceof PolicyHoldException
          ? error.delegationContext
          : undefined,
      );
    }

    if (error instanceof MCPInvocationException) {
      const proxyDetail = formatProxyFailure(error);
      console.error(
        `[broski] ArmorIQ proxy invoke failed for ${BROSKI_MCP}.${step.tool}`,
        {
          statusCode: error.statusCode,
          message: error.message,
          args,
        },
      );

      // Intent action-name check passed client-side. Also bind against the exact
      // signed plan params (invoice ids / amounts) from capturePlan().
      if (!planAllowsCall(planSteps, step.tool, args)) {
        return eventBase(
          step,
          "block",
          "Blocked against the ArmorIQ-signed mandate plan — this tool call’s parameters were never declared (e.g. over-limit invoice).",
        );
      }

      const allowLocal =
        process.env.ARMORIQ_LOCAL_MCP_FALLBACK !== "0" &&
        process.env.ARMORIQ_LOCAL_MCP_FALLBACK !== "false";

      if (!allowLocal) {
        return eventBase(
          step,
          "error",
          `ArmorIQ proxy invoke failed for ${BROSKI_MCP}.${step.tool} (${proxyDetail}). Local MCP fallback disabled.`,
        );
      }

      const result = await executeSandboxTool(step.tool, args);
      return eventBase(
        step,
        "allow",
        `ArmorIQ signed-intent check passed — executed on sandbox MCP. (Proxy detail: ${proxyDetail})`,
        result,
      );
    }

    console.error(
      `[broski] Unexpected ArmorIQ error for ${step.tool}:`,
      formatProxyFailure(error),
    );
    return mapArmorIQError(step, error);
  }
}

export async function runBroskiScenario(input: {
  mandate: MandateConfig;
  scenario: ScenarioId;
  reset?: boolean;
}): Promise<RunResponse> {
  const mandate = input.mandate;
  const planSteps = buildMandatePlanSteps(mandate);
  const steps = scenarioSteps(input.scenario, mandate);
  const mode =
    (process.env.ARMORIQ_SESSION_MODE as "sdk" | "local" | "proxy" | undefined) ||
    "sdk";

  if (!isArmorIQConfigured()) {
    return {
      ok: false,
      configured: false,
      message:
        "Add ARMORIQ_API_KEY from https://platform.armoriq.ai, then onboard agent `Broski` and MCP `broski-invoice-mcp`. Broski will not invent ALLOW/BLOCK results.",
      mandate,
      planGoal: mandate.goal,
      planSteps,
      events: [],
      invoices: listInvoices(),
      enforcementMode: mode,
    };
  }

  // Always reset for full_demo so INV-120 is unpaid every run.
  const shouldReset = input.reset !== false || input.scenario === "full_demo";
  if (shouldReset) {
    resetSandbox();
  }

  const client = createArmorIQClient();

  // Best-effort: warm MCP metadata from ArmorIQ so proxy routing knows the server.
  try {
    await client.loadMcp(BROSKI_MCP);
  } catch (error) {
    console.error(
      `[broski] loadMcp(${BROSKI_MCP}) failed — proxy may not resolve this MCP:`,
      formatProxyFailure(error),
    );
  }

  const plan = {
    goal: mandate.goal,
    steps: planSteps.map((step) => ({
      action: step.tool,
      mcp: BROSKI_MCP,
      params: step.args,
    })),
  };

  const captured = client.capturePlan(
    process.env.BROSKI_LLM || "gpt-4o-mini",
    mandate.goal,
    plan,
  );
  const token = await client.getIntentToken(captured);

  const events: VerdictEvent[] = [];
  for (const step of steps) {
    events.push(
      await runStepThroughArmorIQ({
        client,
        token,
        step,
        planSteps,
        userEmail: mandate.userEmail,
      }),
    );
  }

  return {
    ok: true,
    configured: true,
    mandate,
    planGoal: mandate.goal,
    planSteps,
    events,
    invoices: listInvoices(),
    enforcementMode: mode,
  };
}
