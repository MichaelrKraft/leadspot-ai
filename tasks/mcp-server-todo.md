# MCP Server for LeadSpot.ai - Build Plan

**Goal**: Create a TypeScript MCP server that wraps the 14+ Mautic tools so they can be used from Claude Code CLI.
**Started**: 2026-03-28

---

## Plan

The MCP server will call the LeadSpot **backend API** (FastAPI at localhost:8000), NOT Mautic directly. Each MCP tool maps to a backend endpoint via the `/api/chat` tool-calling loop or direct API routes.

**Key decision**: Since the backend exposes tools via Claude's tool_use loop (not as REST endpoints per-tool), the MCP server will make direct HTTP calls to the Mautic API using the same patterns as `MauticClient`. This gives us clean, direct tool access without going through the chat endpoint.

### Tasks

- [ ] 1. Create `mcp-server/` directory structure
- [ ] 2. Write `package.json` and `tsconfig.json`
- [ ] 3. Write `src/lib/config.ts` - env var configuration
- [ ] 4. Write `src/lib/mautic-client.ts` - HTTP client mirroring backend's MauticClient
- [ ] 5. Write `src/tools/contacts.ts` - 5 contact tools (list, get, create, update, delete + tag/note)
- [ ] 6. Write `src/tools/emails.ts` - 3 email tools (list, send, create)
- [ ] 7. Write `src/tools/campaigns.ts` - 4 campaign tools (list, get, create, add_contact)
- [ ] 8. Write `src/tools/segments.ts` - 2 segment tools (list, add_contact)
- [ ] 9. Write `src/tools/voice.ts` - 2 voice tools (list agents, initiate call)
- [ ] 10. Write `src/index.ts` - MCP server entry point
- [ ] 11. Install dependencies and compile
- [ ] 12. Write README with MCP config entry

---

## Review

(To be filled after completion)
