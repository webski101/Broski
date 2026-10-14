import { ArmorIQClient } from "@armoriq/sdk";

export const BROSKI_MCP = "broski-invoice-mcp";
export const BROSKI_AGENT_ID =
  process.env.AGENT_ID || "d7681f20-2ac7-49db-a8ae-7e1ede22f14b";

export function isArmorIQConfigured() {
  return Boolean(process.env.ARMORIQ_API_KEY?.trim());
}

export function createArmorIQClient() {
  const apiKey = process.env.ARMORIQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "ARMORIQ_API_KEY is missing. Create one at https://platform.armoriq.ai and add it to .env.local",
    );
  }

  return new ArmorIQClient({
    apiKey,
    userId: process.env.USER_ID || "broski-operator",
    agentId: BROSKI_AGENT_ID,
    contextId: process.env.CONTEXT_ID || "broski-hackathon",
    useProduction: process.env.ARMORIQ_ENV !== "development",
    // Optional overrides — only set when debugging proxy routing.
    ...(process.env.PROXY_ENDPOINT
      ? { proxyEndpoint: process.env.PROXY_ENDPOINT }
      : {}),
    ...(process.env.IAP_ENDPOINT
      ? { iapEndpoint: process.env.IAP_ENDPOINT }
      : {}),
    ...(process.env.BACKEND_ENDPOINT
      ? { backendEndpoint: process.env.BACKEND_ENDPOINT }
      : {}),
    // Auth for the registered remote MCP (None on platform → authType none).
    mcpCredentials: {
      [BROSKI_MCP]: { authType: "none" },
    },
  });
}

export function getArmorIQStatus() {
  return {
    configured: isArmorIQConfigured(),
    agentId: BROSKI_AGENT_ID,
    mcp: BROSKI_MCP,
    platform: "https://platform.armoriq.ai",
    env: process.env.ARMORIQ_ENV || "production",
    proxyEndpoint: process.env.PROXY_ENDPOINT || "https://proxy.armoriq.ai",
  };
}
