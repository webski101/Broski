import { randomUUID } from "crypto";
import {
  IntentMismatchException,
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
import { resetSandbox } from "@/lib/sandbox/invoices";
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

function mapArmorIQError(step: RunStepRequest, error: unknown): VerdictEvent {
  if (error instanceof IntentMismatchException) {
    return eventBase(
      step,
      "block",
      error.message ||
        `ArmorIQ intent mismatch: ${step.tool} is outside the signed Broski mandate.`,
    );
  }
  if (error instanceof PolicyBlockedException) {
    return eventBase(
      step,
      "block",
      error.reason || error.message || "ArmorIQ policy blocked this action.",
    );
  }
  if (error instanceof PolicyHoldException) {
    return eventBase(
      step,
      "hold",
      error.message || "ArmorIQ held this action for approval.",
      error.delegationContext,
    );
  }
  if (error instanceof MCPInvocationException) {
    return eventBase(
      step,
      "error",
      error.message || "ArmorIQ MCP invocation failed.",
    );
  }
  const message = error instanceof Error ? error.message : String(error);
  return eventBase(step, "error", message);
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
      "ArmorIQ verified the signed intent and completed the MCP invoke.",
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

    if (error instanceof PolicyBlockedException) {
      return eventBase(
        step,
        "block",
        error.reason || error.message || "ArmorIQ policy blocked this action.",
      );
    }

    if (error instanceof PolicyHoldException) {
      return eventBase(
        step,
        "hold",
        error.message || "ArmorIQ held this action for human approval.",
        error.delegationContext,
      );
    }

    if (error instanceof MCPInvocationException) {
      // Intent action-name check passed client-side. Also bind against the exact
      // signed plan params (invoice ids / amounts) from capturePlan().
      if (!planAllowsCall(planSteps, step.tool, args)) {
        return eventBase(
          step,
          "block",
          "Blocked against the ArmorIQ-signed mandate plan — this tool call’s parameters were never declared (e.g. over-limit invoice).",
        );
      }

      const result = await executeSandboxTool(step.tool, args);
      return eventBase(
        step,
        "allow",
        "ArmorIQ signed-intent check passed. Sandbox MCP ran locally because broski-invoice-mcp is not registered on the ArmorIQ proxy yet — onboard it on platform.armoriq.ai for full proxy routing.",
        result,
      );
    }

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
        "Add ARMORIQ_API_KEY from https://platform.armoriq.ai, then onboard agent `broski-ap-agent` and MCP `broski-invoice-mcp`. Broski will not invent ALLOW/BLOCK results.",
      mandate,
      planGoal: mandate.goal,
      planSteps,
      events: [],
      enforcementMode: mode,
    };
  }

  if (input.reset !== false) {
    resetSandbox();
  }

  const client = createArmorIQClient();
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
    enforcementMode: mode,
  };
}
