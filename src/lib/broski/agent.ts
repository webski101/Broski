import { randomUUID } from "crypto";
import {
  IntentMismatchException,
  PolicyBlockedException,
  PolicyHoldException,
  type ToolCall,
} from "@armoriq/sdk";
import { BROSKI_MCP, createArmorIQClient, isArmorIQConfigured } from "@/lib/armoriq";
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

function toToolCalls(
  steps: Array<{ tool: string; args: Record<string, unknown> }>,
): ToolCall[] {
  return steps.map((step) => ({
    name: `${BROSKI_MCP}.${step.tool}`,
    args: step.args,
  }));
}

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

export async function runBroskiScenario(input: {
  mandate: MandateConfig;
  scenario: ScenarioId;
  reset?: boolean;
}): Promise<RunResponse> {
  const mandate = input.mandate;
  const planSteps = buildMandatePlanSteps(mandate);
  const steps = scenarioSteps(input.scenario, mandate);

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
      enforcementMode: "sdk",
    };
  }

  if (input.reset !== false) {
    resetSandbox();
  }

  const client = createArmorIQClient();
  const mode =
    (process.env.ARMORIQ_SESSION_MODE as "sdk" | "local" | "proxy" | undefined) ||
    "sdk";

  const session = client.forUser(mandate.userEmail).startSession({
    mode,
    defaultMcpName: BROSKI_MCP,
    llm: process.env.BROSKI_LLM || "gpt-4o-mini",
    validitySeconds: 1800,
  });

  const toolCalls = toToolCalls(planSteps);
  await session.startPlan(toolCalls, mandate.goal);

  const events: VerdictEvent[] = [];

  for (const step of steps) {
    const toolName = `${BROSKI_MCP}.${step.tool}`;
    const args = step.args ?? {};

    try {
      if (mode === "proxy") {
        const dispatched = await session.dispatch(toolName, args);
        events.push(
          eventBase(
            step,
            "allow",
            "ArmorIQ proxy verified intent and forwarded the MCP call.",
            dispatched,
          ),
        );
        continue;
      }

      const decision = await session.enforce(toolName, args);

      if (decision.action === "block" || decision.allowed === false) {
        events.push(
          eventBase(
            step,
            "block",
            decision.reason ||
              decision.matchedPolicy ||
              "ArmorIQ blocked this action against the signed mandate.",
          ),
        );
        await session.report(toolName, args, {
          blocked: true,
          reason: decision.reason,
        }, { status: "failed" });
        continue;
      }

      if (decision.action === "hold") {
        events.push(
          eventBase(
            step,
            "hold",
            decision.reason ||
              "ArmorIQ held this action for human approval (delegation).",
            { delegationId: decision.delegationId },
          ),
        );
        await session.report(toolName, args, {
          held: true,
          delegationId: decision.delegationId,
        }, { status: "failed" });
        continue;
      }

      const result = await executeSandboxTool(step.tool, args);
      await session.report(toolName, args, result, { status: "success" });
      events.push(
        eventBase(
          step,
          "allow",
          decision.reason ||
            "ArmorIQ allowed this action — it matches the signed mandate.",
          result,
        ),
      );
    } catch (error) {
      if (error instanceof IntentMismatchException) {
        events.push(
          eventBase(
            step,
            "block",
            error.message ||
              `Intent mismatch: ${step.tool} is outside the signed Broski mandate.`,
          ),
        );
        continue;
      }
      if (error instanceof PolicyBlockedException) {
        events.push(
          eventBase(
            step,
            "block",
            error.reason || error.message || "Policy blocked by ArmorIQ.",
          ),
        );
        continue;
      }
      if (error instanceof PolicyHoldException) {
        events.push(
          eventBase(
            step,
            "hold",
            error.message || "ArmorIQ held action for approval.",
            error.delegationContext,
          ),
        );
        continue;
      }

      const message = error instanceof Error ? error.message : String(error);
      events.push(eventBase(step, "error", message));
    }
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
