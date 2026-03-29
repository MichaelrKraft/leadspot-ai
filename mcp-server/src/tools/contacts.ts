/**
 * Contact management tools for the LeadSpot MCP server.
 *
 * Wraps the backend's Mautic contact endpoints:
 * - list, get, create, update, delete
 * - tag management, notes, lead scoring
 */

import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type LeadSpotClient } from "../lib/mautic-client.js";

export function registerContactTools(
  server: McpServer,
  client: LeadSpotClient,
  organizationId: string,
): void {
  // ── List Contacts ─────────────────────────────────────────────────────
  server.tool(
    "leadspot_contacts_list",
    "List contacts from Mautic CRM. Supports search and sorting by engagement score, date, or name.",
    {
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Max contacts to return (1-100, default 30)"),
      search: z
        .string()
        .optional()
        .describe(
          "Search query - name, email, company, or Mautic syntax like 'email:*@acme.com' or 'tag:hot-lead'",
        ),
      order_by: z
        .enum([
          "date_added",
          "last_active",
          "points",
          "firstname",
          "lastname",
          "email",
        ])
        .optional()
        .describe("Field to sort by (default: date_added)"),
    },
    async ({ limit, search, order_by }) => {
      try {
        const result = await client.chat(
          buildContactListPrompt(limit, search, order_by),
          organizationId,
        );
        return { content: [{ type: "text" as const, text: formatResult(result) }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── Get Contact ───────────────────────────────────────────────────────
  server.tool(
    "leadspot_contacts_get",
    "Get detailed information about a specific contact including profile, tags, and activity summary.",
    {
      contact_id: z.number().describe("The Mautic contact ID"),
    },
    async ({ contact_id }) => {
      try {
        const result = await client.chat(
          `Get full details for contact ID ${contact_id}. Show their name, email, company, phone, points, tags, and recent activity.`,
          organizationId,
        );
        return { content: [{ type: "text" as const, text: formatResult(result) }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── Create Contact ────────────────────────────────────────────────────
  server.tool(
    "leadspot_contacts_create",
    "Create a new contact in Mautic CRM. Email is required.",
    {
      email: z.string().email().describe("Contact email address (required)"),
      firstname: z.string().optional().describe("First name"),
      lastname: z.string().optional().describe("Last name"),
      company: z.string().optional().describe("Company name"),
      phone: z.string().optional().describe("Phone number"),
    },
    async ({ email, firstname, lastname, company, phone }) => {
      try {
        const fields = [`email: ${email}`];
        if (firstname) fields.push(`first name: ${firstname}`);
        if (lastname) fields.push(`last name: ${lastname}`);
        if (company) fields.push(`company: ${company}`);
        if (phone) fields.push(`phone: ${phone}`);

        const result = await client.chat(
          `Create a new contact with the following details: ${fields.join(", ")}`,
          organizationId,
        );
        return { content: [{ type: "text" as const, text: formatResult(result) }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── Update Contact ────────────────────────────────────────────────────
  server.tool(
    "leadspot_contacts_update",
    "Update an existing contact's information in Mautic.",
    {
      contact_id: z.number().describe("The Mautic contact ID to update"),
      email: z.string().email().optional().describe("New email address"),
      firstname: z.string().optional().describe("New first name"),
      lastname: z.string().optional().describe("New last name"),
      company: z.string().optional().describe("New company name"),
      phone: z.string().optional().describe("New phone number"),
    },
    async ({ contact_id, email, firstname, lastname, company, phone }) => {
      try {
        const updates: string[] = [];
        if (email) updates.push(`email to ${email}`);
        if (firstname) updates.push(`first name to ${firstname}`);
        if (lastname) updates.push(`last name to ${lastname}`);
        if (company) updates.push(`company to ${company}`);
        if (phone) updates.push(`phone to ${phone}`);

        const result = await client.chat(
          `Update contact ID ${contact_id}: change ${updates.join(", ")}`,
          organizationId,
        );
        return { content: [{ type: "text" as const, text: formatResult(result) }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── Delete Contact ────────────────────────────────────────────────────
  server.tool(
    "leadspot_contacts_delete",
    "Delete a contact from Mautic CRM. This action cannot be undone.",
    {
      contact_id: z.number().describe("The Mautic contact ID to delete"),
    },
    async ({ contact_id }) => {
      try {
        const result = await client.chat(
          `Delete contact ID ${contact_id} from the CRM.`,
          organizationId,
        );
        return { content: [{ type: "text" as const, text: formatResult(result) }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── Add Tag ───────────────────────────────────────────────────────────
  server.tool(
    "leadspot_contacts_add_tag",
    "Add a tag to a contact for categorization and segmentation.",
    {
      contact_id: z.number().describe("The Mautic contact ID"),
      tag: z
        .string()
        .describe("Tag to add (e.g. 'hot-lead', 'webinar-attended')"),
    },
    async ({ contact_id, tag }) => {
      try {
        const result = await client.chat(
          `Add the tag "${tag}" to contact ID ${contact_id}.`,
          organizationId,
        );
        return { content: [{ type: "text" as const, text: formatResult(result) }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── Add Note ──────────────────────────────────────────────────────────
  server.tool(
    "leadspot_contacts_add_note",
    "Add a note to a contact's timeline.",
    {
      contact_id: z.number().describe("The Mautic contact ID"),
      note: z.string().describe("Note content to add to the contact timeline"),
    },
    async ({ contact_id, note }) => {
      try {
        const result = await client.chat(
          `Add a note to contact ID ${contact_id}: "${note}"`,
          organizationId,
        );
        return { content: [{ type: "text" as const, text: formatResult(result) }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── Score Lead ────────────────────────────────────────────────────────
  server.tool(
    "leadspot_contacts_score",
    "Calculate engagement score for a contact and optionally tag as hot/warm/cold lead.",
    {
      contact_id: z.number().describe("The Mautic contact ID to score"),
      auto_tag: z
        .boolean()
        .optional()
        .describe(
          "Automatically apply tier tag (hot-lead, warm-lead, cold-lead). Default true.",
        ),
    },
    async ({ contact_id, auto_tag }) => {
      try {
        const tagNote =
          auto_tag === false ? " Do NOT auto-tag." : " Auto-tag the lead tier.";
        const result = await client.chat(
          `Score lead for contact ID ${contact_id}.${tagNote}`,
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

function buildContactListPrompt(
  limit?: number,
  search?: string,
  orderBy?: string,
): string {
  const parts = ["Show me my contacts"];
  if (search) parts.push(`matching "${search}"`);
  if (orderBy === "points") parts.push("sorted by engagement score (highest first)");
  else if (orderBy === "last_active") parts.push("sorted by most recently active");
  else if (orderBy) parts.push(`sorted by ${orderBy}`);
  if (limit) parts.push(`(limit ${limit})`);
  return parts.join(" ");
}

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
