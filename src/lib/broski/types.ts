export type VerdictAction = "allow" | "block" | "hold" | "error";

export type MandateConfig = {
  title: string;
  goal: string;
  maxAmount: number;
  allowedInvoiceIds: string[];
  userEmail: string;
  allowNewPayees: boolean;
  allowWires: boolean;
};

export type ScenarioId =
  | "pay_under_limit"
  | "prompt_injection_wire"
  | "over_limit_invoice"
  | "full_demo";

export type RunStepRequest = {
  tool: string;
  args?: Record<string, unknown>;
  label: string;
};

export type VerdictEvent = {
  id: string;
  at: string;
  label: string;
  tool: string;
  args: Record<string, unknown>;
  action: VerdictAction;
  reason: string;
  source: "armoriq";
  result?: unknown;
};

export type RunResponse = {
  ok: boolean;
  configured: boolean;
  message?: string;
  mandate: MandateConfig;
  planGoal: string;
  planSteps: Array<{ tool: string; args: Record<string, unknown> }>;
  events: VerdictEvent[];
  enforcementMode: "sdk" | "local" | "proxy";
};
