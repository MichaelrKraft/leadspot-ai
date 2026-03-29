/**
 * Voice and chat tools for the LeadSpot MCP server.
 *
 * Provides:
 * - Natural language chat with the LeadSpot AI agent
 * - CRM summary/overview
 */

import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type LeadSpotClient } from "../lib/mautic-client.js";

export function registerVoiceTools(
  server: McpServer,
  client: LeadSpotClient,
  organizationId: string,
): void {
  // ── Chat with LeadSpot AI ─────────────────────────────────────────────
  server.tool(
    "leadspot_chat",
    "Send a natural language command to the LeadSpot AI agent. The agent can read and write CRM data, manage contacts, send emails, and more. Use this for complex requests that span multiple operations.",
    {
      message: z
        .string()
        .min(1)
        .max(4000)
        .describe("Natural language command or question for the AI agent"),
    },
    async ({ message }) => {
      try {
        const result = await client.chat(message, organizationId);
        return { content: [{ type: "text" as const, text: formatResult(result) }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── CRM Summary ───────────────────────────────────────────────────────
  server.tool(
    "leadspot_crm_summary",
    "Get a quick overview of the Mautic CRM instance with total counts of contacts, emails, campaigns, and segments.",
    {},
    async () => {
      try {
        const result = await client.chat(
          "Give me a CRM overview with total counts of contacts, emails, campaigns, and segments.",
          organizationId,
        );
        return { content: [{ type: "text" as const, text: formatResult(result) }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── Chat Status ───────────────────────────────────────────────────────
  server.tool(
    "leadspot_status",
    "Check the LeadSpot backend service status and whether AI and Mautic tools are configured.",
    {},
    async () => {
      try {
        const result = await client.get("/api/chat/status");
        return { content: [{ type: "text" as const, text: formatResult(result) }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatResult(result: unknown): string {
  if (typeof result === "string") return result;
  if (typeof result === "object" && result !== null) {
    const obj = result as Record<string, unknown>;
    if (typeof obj["response"] === "string") return obj["response"];
    if (typeof obj["message"] === "string") return obj["message"];
    return JSON.stringify(result, null, 2);
  }
  return String(result);
}

function errorResponse(
  error: unknown,
): { content: Array<{ type: "text"; text: string }>; isError: true } {
  const message =
    error instanceof Error ? error.message : "Unknown error occurred";
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}
