/**
 * Segment management tools for the LeadSpot MCP server.
 *
 * Wraps the backend's Mautic segment endpoints:
 * - list, create, add contact
 */

import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type LeadSpotClient } from "../lib/mautic-client.js";

export function registerSegmentTools(
  server: McpServer,
  client: LeadSpotClient,
  organizationId: string,
): void {
  // ── List Segments ─────────────────────────────────────────────────────
  server.tool(
    "leadspot_segments_list",
    "List contact segments from Mautic. Returns segment names and contact counts.",
    {
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Max segments to return (1-100, default 30)"),
    },
    async ({ limit }) => {
      try {
        const parts = ["List my segments"];
        if (limit) parts.push(`(limit ${limit})`);

        const result = await client.chat(parts.join(" "), organizationId);
        return { content: [{ type: "text" as const, text: formatResult(result) }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── Create Segment ────────────────────────────────────────────────────
  server.tool(
    "leadspot_segments_create",
    "Create a new contact segment in Mautic.",
    {
      name: z.string().describe("Segment name"),
      description: z.string().optional().describe("Segment description"),
    },
    async ({ name, description }) => {
      try {
        let prompt = `Create a new segment named "${name}"`;
        if (description) prompt += ` with description: "${description}"`;

        const result = await client.chat(prompt, organizationId);
        return { content: [{ type: "text" as const, text: formatResult(result) }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── Add Contact to Segment ────────────────────────────────────────────
  server.tool(
    "leadspot_segments_add_contact",
    "Add a contact to a segment for targeted marketing.",
    {
      segment_id: z.number().describe("The segment ID"),
      contact_id: z
        .number()
        .describe("The contact ID to add to the segment"),
    },
    async ({ segment_id, contact_id }) => {
      try {
        const result = await client.chat(
          `Add contact ID ${contact_id} to segment ID ${segment_id}.`,
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
