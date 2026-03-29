/**
 * Email management tools for the LeadSpot MCP server.
 *
 * Wraps the backend's Mautic email endpoints:
 * - list, get, create, send
 */

import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type LeadSpotClient } from "../lib/mautic-client.js";

export function registerEmailTools(
  server: McpServer,
  client: LeadSpotClient,
  organizationId: string,
): void {
  // ── List Emails ───────────────────────────────────────────────────────
  server.tool(
    "leadspot_emails_list",
    "List email templates and campaigns from Mautic. Returns names, subjects, and statistics.",
    {
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Max emails to return (1-100, default 30)"),
      search: z
        .string()
        .optional()
        .describe("Search query to filter emails by name or subject"),
    },
    async ({ limit, search }) => {
      try {
        const parts = ["List my email templates"];
        if (search) parts.push(`matching "${search}"`);
        if (limit) parts.push(`(limit ${limit})`);

        const result = await client.chat(parts.join(" "), organizationId);
        return { content: [{ type: "text" as const, text: formatResult(result) }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── Get Email ─────────────────────────────────────────────────────────
  server.tool(
    "leadspot_emails_get",
    "Get detailed information about a specific email including content, statistics, and send history.",
    {
      email_id: z.number().describe("The Mautic email ID"),
    },
    async ({ email_id }) => {
      try {
        const result = await client.chat(
          `Get details for email ID ${email_id}. Show the subject, content preview, and statistics.`,
          organizationId,
        );
        return { content: [{ type: "text" as const, text: formatResult(result) }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── Create Email ──────────────────────────────────────────────────────
  server.tool(
    "leadspot_emails_create",
    "Create a new email template in Mautic. The email is created as unpublished (draft).",
    {
      name: z.string().describe("Internal name for the email"),
      subject: z.string().describe("Email subject line"),
      body: z.string().describe("HTML body content of the email"),
      from_name: z.string().optional().describe("Sender name"),
    },
    async ({ name, subject, body, from_name }) => {
      try {
        let prompt = `Create a new email template named "${name}" with subject "${subject}" and this HTML body: ${body}`;
        if (from_name) prompt += `. Set the from name to "${from_name}"`;

        const result = await client.chat(prompt, organizationId);
        return { content: [{ type: "text" as const, text: formatResult(result) }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── Send Email ────────────────────────────────────────────────────────
  server.tool(
    "leadspot_emails_send",
    "Send an email to a specific contact. The email must already exist as a template in Mautic.",
    {
      email_id: z.number().describe("The Mautic email ID to send"),
      contact_id: z.number().describe("The contact ID to send the email to"),
    },
    async ({ email_id, contact_id }) => {
      try {
        const result = await client.chat(
          `Send email ID ${email_id} to contact ID ${contact_id}.`,
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
