/**
 * Campaign management tools for the LeadSpot MCP server.
 *
 * Wraps the backend's Mautic campaign endpoints:
 * - list, get, create, publish, add contact
 */

import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type LeadSpotClient } from "../lib/mautic-client.js";

export function registerCampaignTools(
  server: McpServer,
  client: LeadSpotClient,
  organizationId: string,
): void {
  // ── List Campaigns ────────────────────────────────────────────────────
  server.tool(
    "leadspot_campaigns_list",
    "List campaigns (automation workflows) from Mautic. Shows name, status, and contact counts.",
    {
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Max campaigns to return (1-100, default 30)"),
      search: z
        .string()
        .optional()
        .describe("Search query to filter campaigns by name"),
    },
    async ({ limit, search }) => {
      try {
        const parts = ["List my campaigns"];
        if (search) parts.push(`matching "${search}"`);
        if (limit) parts.push(`(limit ${limit})`);

        const result = await client.chat(parts.join(" "), organizationId);
        return { content: [{ type: "text" as const, text: formatResult(result) }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── Get Campaign ──────────────────────────────────────────────────────
  server.tool(
    "leadspot_campaigns_get",
    "Get detailed information about a specific campaign including events, triggers, and statistics.",
    {
      campaign_id: z.number().describe("The Mautic campaign ID"),
    },
    async ({ campaign_id }) => {
      try {
        const result = await client.chat(
          `Get details for campaign ID ${campaign_id}. Show its name, description, status, events, and statistics.`,
          organizationId,
        );
        return { content: [{ type: "text" as const, text: formatResult(result) }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── Create Campaign ───────────────────────────────────────────────────
  server.tool(
    "leadspot_campaigns_create",
    "Create a new campaign (automation workflow) in Mautic. Created as unpublished (draft).",
    {
      name: z.string().describe("Campaign name"),
      description: z.string().optional().describe("Campaign description"),
    },
    async ({ name, description }) => {
      try {
        let prompt = `Create a new campaign named "${name}"`;
        if (description) prompt += ` with description: "${description}"`;

        const result = await client.chat(prompt, organizationId);
        return { content: [{ type: "text" as const, text: formatResult(result) }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── Publish Campaign ──────────────────────────────────────────────────
  server.tool(
    "leadspot_campaigns_publish",
    "Publish a campaign to make it active and start processing contacts.",
    {
      campaign_id: z.number().describe("The campaign ID to publish"),
    },
    async ({ campaign_id }) => {
      try {
        const result = await client.chat(
          `Publish campaign ID ${campaign_id} to make it active.`,
          organizationId,
        );
        return { content: [{ type: "text" as const, text: formatResult(result) }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── Add Contact to Campaign ───────────────────────────────────────────
  server.tool(
    "leadspot_campaigns_add_contact",
    "Add a contact to a campaign (automation workflow).",
    {
      campaign_id: z.number().describe("The campaign ID"),
      contact_id: z.number().describe("The contact ID to add to the campaign"),
    },
    async ({ campaign_id, contact_id }) => {
      try {
        const result = await client.chat(
          `Add contact ID ${contact_id} to campaign ID ${campaign_id}.`,
          organizationId,
        );
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
