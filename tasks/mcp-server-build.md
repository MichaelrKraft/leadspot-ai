# MCP Server Build Plan

## Tasks
- [x] Read backend API to understand endpoints (mautic_tools.py, mautic_client.py, chat.py)
- [x] Create directory structure: mcp-server/src/{tools,lib}
- [x] Write package.json with dependencies
- [x] Write tsconfig.json (strict mode)
- [x] Write src/lib/config.ts (env vars)
- [x] Write src/lib/mautic-client.ts (HTTP client wrapping backend API)
- [x] Write src/tools/contacts.ts (list, get, create, update, delete, tag, note, score)
- [x] Write src/tools/emails.ts (list, get, create, send)
- [x] Write src/tools/campaigns.ts (list, get, create, publish, add contact)
- [x] Write src/tools/segments.ts (list, create, add contact)
- [x] Write src/tools/voice.ts (chat endpoint wrapper)
- [x] Write src/index.ts (MCP server entry point)
- [x] Write README.md
- [x] Run npm install
- [x] Run tsc and fix compile errors

## Review

### Summary
Built a complete MCP server at `/Users/michaelkraft/leadspot/mcp-server/` that exposes 22 LeadSpot CRM tools to Claude Code and other MCP clients.

### Architecture Decision
The MCP server acts as a **thin proxy** to the LeadSpot backend's `/api/chat` endpoint. Rather than duplicating Mautic API logic, each tool translates its structured input into a natural language prompt that the backend's Claude agent executes with full Mautic tool calling. This means:
- No OAuth token management in the MCP server
- All 14+ Mautic tools available through the backend's existing Claude integration
- Single source of truth for business logic

### Files Created (10 files)
- `package.json` - @leadspot/mcp-server, ESM, MCP SDK dependency
- `tsconfig.json` - Strict mode, ES2022/Node16
- `src/index.ts` - Entry point with shebang, StdioServerTransport
- `src/lib/config.ts` - LEADSPOT_API_URL, LEADSPOT_API_KEY, LEADSPOT_ORG_ID env vars
- `src/lib/mautic-client.ts` - HTTP client with get/post/put/patch/delete/chat methods
- `src/tools/contacts.ts` - 8 tools: list, get, create, update, delete, add_tag, add_note, score
- `src/tools/emails.ts` - 4 tools: list, get, create, send
- `src/tools/campaigns.ts` - 5 tools: list, get, create, publish, add_contact
- `src/tools/segments.ts` - 3 tools: list, create, add_contact
- `src/tools/voice.ts` - 3 tools: chat, crm_summary, status
- `README.md` - Setup instructions for Claude Code and Claude Desktop

### Build Results
- `npm install`: 99 packages, 0 vulnerabilities
- `npx tsc`: Clean compile, zero errors
- All .js, .d.ts, .js.map, .d.ts.map files generated in dist/

### Next Step
Add to `~/.mcp.json` to start using with Claude Code.
