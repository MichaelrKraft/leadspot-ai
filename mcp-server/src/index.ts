#!/usr/bin/env node

/**
 * LeadSpot MCP Server
 *
 * Exposes LeadSpot.ai CRM tools (contacts, emails, campaigns, segments)
 * to Claude Code and other MCP clients via the Model Context Protocol.
 *
 * The server communicates over stdio and proxies requests to the
 * LeadSpot backend API, which handles Mautic integration.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./lib/config.js";
import { LeadSpotClient } from "./lib/mautic-client.js";
import { registerContactTools } from "./tools/contacts.js";
import { registerEmailTools } from "./tools/emails.js";
import { registerCampaignTools } from "./tools/campaigns.js";
import { registerSegmentTools } from "./tools/segments.js";
import { registerVoiceTools } from "./tools/voice.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new LeadSpotClient(config);

  const server = new McpServer({
    name: "leadspot",
    version: "1.0.0",
  });

  // Register all tool groups
  registerContactTools(server, client, config.organizationId);
  registerEmailTools(server, client, config.organizationId);
  registerCampaignTools(server, client, config.organizationId);
  registerSegmentTools(server, client, config.organizationId);
  registerVoiceTools(server, client, config.organizationId);

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with MCP stdio protocol
  console.error("LeadSpot MCP server running on stdio");
}

main().catch((error: unknown) => {
  console.error("Fatal error starting LeadSpot MCP server:", error);
  process.exit(1);
});
