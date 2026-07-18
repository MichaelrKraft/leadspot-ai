"""
Chat routes for LeadSpot AI Command Center — DEPRECATED

Handles natural language commands from the Mautic plugin. Kept only for the
Mautic plugin integration; all new conversational AI work happens in
`routers/conv_ai.py` (`POST /api/v2/chat` — SSE streaming, citations,
confirm-gated writes, thread memory). Do not add features here.
"""

import json
import logging
import os
from datetime import datetime

import httpx
from anthropic import AsyncAnthropic
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

AGENT_SERVICE_URL = os.environ.get("AGENT_SERVICE_URL", "http://localhost:3008")
from app.database import get_db
from app.models.user import User
from app.services.auth_service import get_current_user
from app.services.leadspot_tools import (
    LEADSPOT_READ_TOOLS,
    LEADSPOT_TOOL_NAMES,
    execute_leadspot_tool,
    format_leadspot_result_for_display,
)
from app.services.mautic_client import MauticAuthError, MauticClient
from app.services.mautic_tools import (
    MAUTIC_READ_TOOLS,
    MAUTIC_WRITE_TOOLS,
    execute_tool,
    format_tool_result_for_display,
)

logger = logging.getLogger(__name__)

router = APIRouter()


class ChatRequest(BaseModel):
    """Request model for chat messages"""
    message: str = Field(..., min_length=1, max_length=4000, description="User's message/command")
    mautic_url: str | None = Field(None, description="Mautic instance URL for context")
    organization_id: str | None = Field(None, description="Ignored — org is derived from the auth token (kept for API compatibility)")
    enable_tools: bool = Field(True, description="Enable Mautic tool calling")


class ToolCall(BaseModel):
    """Represents a tool call made by the AI"""
    tool_name: str
    tool_input: dict
    result: dict | None = None


class ChatResponse(BaseModel):
    """Response model for chat messages"""
    response: str = Field(..., description="AI agent's response")
    message: str | None = Field(None, description="Alternative response field for compatibility")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    status: str = Field(default="success")
    tools_used: list[str] = Field(default_factory=list, description="List of tools that were used")
    tool_results: list[dict] | None = Field(None, description="Results from tool calls")


# System prompt for the AI agent with tool calling
SYSTEM_PROMPT = """You are LeadSpot AI, the autonomous AI agent built into LeadSpot — an AI-first CRM for real estate agents.

Your role is to help users manage their real estate business through natural language commands. You have direct access to the LeadSpot CRM through tools. Never mention "Mautic" — LeadSpot IS the product.

## Your Capabilities

**📋 Contact Management**
- Search and browse contacts
- View contact details and activity history
- Add/remove tags
- Add notes to contact timelines
- Create and update contacts
- Add contacts to segments and campaigns

**📧 Email Campaigns**
- List and search email templates
- View email details and statistics
- Create new email templates
- Send emails to contacts or segments

**🔄 Campaign/Workflow Automation**
- List and view campaigns
- Create new campaigns
- Publish/unpublish campaigns
- Add contacts to campaigns

**👥 Segments**
- List and view segments
- Create new segments
- Add contacts to segments

## Guidelines

1. **Use tools proactively**: When users ask about contacts, emails, or campaigns, use the appropriate tool to fetch real data.

2. **Be helpful and concise**: Summarize data clearly. Don't dump raw JSON - present information in a readable format.

3. **Confirm before destructive actions**: Before sending emails, deleting data, or making bulk changes, confirm with the user.

4. **Handle errors gracefully**: If a tool fails, explain what happened and suggest alternatives.

5. **Use emojis sparingly**: ✅ for success, ❌ for errors, 📧 for emails, 👥 for contacts, etc.

6. **Be proactive**: If a user asks "show me my contacts", use get_contacts. If they ask "how many emails do I have", use get_emails.

## Example Interactions

User: "Show me my top contacts"
→ Use get_contacts with order_by="points" to get contacts sorted by engagement score

User: "Find contacts from Acme Corp"
→ Use get_contacts with search="company:Acme Corp"

User: "Tag John Smith as a hot lead"
→ First use get_contacts with search to find John, then use add_tag

User: "Create a welcome email"
→ Use create_email to create a new email template

User: "What's my CRM overview?"
→ Use get_summary_stats to get counts of contacts, emails, campaigns, and segments
"""


async def fetch_agent_context(
    organization_id: str,
    contact_id: str = None,
    message: str = None,
) -> str:
    """Fetch memory context from the agent-service to enrich chat prompts."""
    try:
        params = {"organizationId": organization_id}
        if contact_id:
            params["contactId"] = contact_id
        if message:
            params["message"] = message

        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{AGENT_SERVICE_URL}/api/agent/context",
                params=params,
                headers={
                    "X-Internal-Api-Key": settings.INTERNAL_API_KEY,
                    "X-Organization-Id": organization_id,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                context_parts = []

                if data.get("context"):
                    context_parts.append(data["context"])

                if data.get("latestBrief"):
                    brief = data["latestBrief"]
                    context_parts.append(
                        f"\n## Latest Pipeline Brief ({brief.get('generatedAt', 'unknown')})\n"
                        f"{brief.get('summary', 'No summary available.')}\n"
                        f"New leads: {brief.get('newLeads', 0)}, "
                        f"Follow-ups needed: {brief.get('followUpsNeeded', 0)}, "
                        f"Deals at risk: {brief.get('dealsAtRisk', 0)}"
                    )

                if data.get("recentSuggestions"):
                    suggestions = data["recentSuggestions"]
                    if suggestions:
                        lines = ["\n## Recent AI Suggestions"]
                        for s in suggestions:
                            lines.append(
                                f"- [{s.get('status', 'pending')}] "
                                f"{s.get('type', '')}: {s.get('title', '')}"
                            )
                        context_parts.append("\n".join(lines))

                return "\n\n".join(context_parts) if context_parts else ""
            return ""
    except Exception as e:
        # Agent service may not be running - graceful fallback
        logger.debug(f"Agent context fetch failed (non-critical): {e}")
        return ""


async def get_mautic_client_for_org(
    organization_id: str,
    session: AsyncSession,
) -> MauticClient | None:
    """Get a MauticClient for the organization if Mautic is connected."""
    try:
        return await MauticClient.from_organization(organization_id, session)
    except MauticAuthError:
        return None


async def run_tool_loop(
    client: AsyncAnthropic,
    messages: list[dict],
    tools: list[dict],
    mautic_client: MauticClient | None,
    org_id: str,
    session: AsyncSession,
    user_id: str = "",
    system_prompt: str = SYSTEM_PROMPT,
    max_iterations: int = 10,
) -> tuple[str, list[str], list[dict]]:
    """
    Run the Claude tool calling loop until we get a final response.

    Returns:
        Tuple of (final_response_text, list_of_tools_used, list_of_tool_results)
    """
    tools_used = []
    tool_results = []

    for iteration in range(max_iterations):
        # Call Claude
        response = await client.messages.create(
            model=settings.SYNTHESIS_MODEL,
            max_tokens=2048,
            system=system_prompt,
            messages=messages,
            tools=tools,
        )

        # Check if Claude wants to use tools or is done
        if response.stop_reason == "end_turn":
            # Claude is done - extract final text response
            text_content = [
                block.text for block in response.content
                if hasattr(block, "text")
            ]
            return "\n".join(text_content), tools_used, tool_results

        elif response.stop_reason == "tool_use":
            # Claude wants to use tools
            tool_use_blocks = [
                block for block in response.content
                if block.type == "tool_use"
            ]

            # Add assistant's response to messages
            messages.append({
                "role": "assistant",
                "content": response.content,
            })

            # Execute each tool and collect results
            tool_result_content = []
            for tool_block in tool_use_blocks:
                tool_name = tool_block.name
                tool_input = tool_block.input

                logger.info(f"Executing tool: {tool_name} with input: {tool_input}")
                tools_used.append(tool_name)

                # Execute the tool — native LeadSpot tools query the local DB;
                # anything else routes to the Mautic integration
                if tool_name in LEADSPOT_TOOL_NAMES:
                    result = await execute_leadspot_tool(tool_name, tool_input, org_id, session, user_id)
                    display = format_leadspot_result_for_display(tool_name, result)
                elif mautic_client:
                    result = await execute_tool(tool_name, tool_input, mautic_client)
                    display = format_tool_result_for_display(tool_name, result)
                else:
                    result = {"success": False, "error": f"Tool {tool_name} is not available"}
                    display = f"{tool_name}: unavailable"
                tool_results.append({
                    "tool": tool_name,
                    "input": tool_input,
                    "success": result.get("success"),
                    "display": display,
                })

                # Format result for Claude
                tool_result_content.append({
                    "type": "tool_result",
                    "tool_use_id": tool_block.id,
                    "content": json.dumps(result, default=str),
                })

            # Add tool results to messages
            messages.append({
                "role": "user",
                "content": tool_result_content,
            })

        else:
            # Unexpected stop reason
            logger.warning(f"Unexpected stop_reason: {response.stop_reason}")
            text_content = [
                block.text for block in response.content
                if hasattr(block, "text")
            ]
            return "\n".join(text_content) if text_content else "I encountered an issue.", tools_used, tool_results

    # Max iterations reached
    logger.warning(f"Max tool iterations ({max_iterations}) reached")
    return "I apologize, but I couldn't complete this task within the allowed steps. Please try a simpler request.", tools_used, tool_results


@router.post("/chat", response_model=ChatResponse, deprecated=True)
async def process_chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Process a chat message from the dashboard command center.

    This endpoint receives natural language commands and returns AI-generated responses.
    When Mautic is connected, the AI can use tools to read and write CRM data.

    Requires authentication. The organization is always derived from the
    authenticated user's token — client-supplied organization_id/mautic_url
    are ignored for authorization (they previously allowed cross-org access).

    - **message**: User's natural language command
    - **enable_tools**: Enable/disable tool calling (default: true)

    Returns an AI response with optional tool call results.
    """
    org_id = str(current_user.organization_id)
    try:
        # Check if Anthropic API key is configured
        if not settings.ANTHROPIC_API_KEY:
            logger.warning("ANTHROPIC_API_KEY not configured")
            return ChatResponse(
                response="⚠️ AI backend is not fully configured. Please add your Anthropic API key in the settings.",
                message="AI backend not configured",
                status="partial"
            )

        # Create Anthropic client
        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

        # Try to get Mautic client if organization_id provided
        mautic_client = None
        tools = []

        if request.enable_tools:
            # Native LeadSpot tools are always available — they query the local DB
            tools = list(LEADSPOT_READ_TOOLS)

            mautic_client = await get_mautic_client_for_org(
                org_id,
                session,
            )
            if mautic_client:
                tools += MAUTIC_READ_TOOLS + MAUTIC_WRITE_TOOLS
                logger.info(f"Mautic tools enabled for org {org_id}")
            else:
                logger.info(f"No Mautic connection for org {org_id}; native tools only")

        # Fetch agent memory context
        agent_context = await fetch_agent_context(
            organization_id=org_id,
            message=request.message,
        )

        # Inject into system prompt if available
        enriched_system_prompt = SYSTEM_PROMPT
        if agent_context:
            enriched_system_prompt += (
                "\n\n---\n\n## Agent Intelligence\n"
                "The following context comes from your AI agent's memory system. "
                "Use it to give informed, personalized responses:\n\n"
                f"{agent_context}"
            )

        # Build initial messages
        messages = [{"role": "user", "content": request.message}]

        # Add context about Mautic connection status
        if mautic_client:
            context_note = f"\n\n[System: Mautic is connected at {mautic_client.mautic_url}. You have full API access.]"
            messages[0]["content"] += context_note

        # Run the conversation (with or without tools)
        if tools:
            # Full tool calling mode
            response_text, tools_used, tool_results = await run_tool_loop(
                client=client,
                messages=messages,
                tools=tools,
                mautic_client=mautic_client,
                org_id=org_id,
                session=session,
                user_id=str(current_user.user_id),
                system_prompt=enriched_system_prompt,
            )

            logger.info(f"Chat completed. Tools used: {tools_used}")

            return ChatResponse(
                response=response_text,
                message=response_text,
                status="success",
                tools_used=tools_used,
                tool_results=tool_results if tool_results else None,
            )

        else:
            # Simple mode without tools
            response = await client.messages.create(
                model=settings.SYNTHESIS_MODEL,
                max_tokens=1024,
                system=enriched_system_prompt,
                messages=messages,
            )

            response_text = response.content[0].text if response.content else "I couldn't generate a response."

            logger.info(f"Chat processed (no tools). Input: {request.message[:50]}...")

            return ChatResponse(
                response=response_text,
                message=response_text,
                status="success",
            )

    except Exception as e:
        logger.exception(f"Error processing chat: {e!s}")

        # Return user-friendly error
        error_message = "I encountered an issue processing your request. Please try again."

        if "api_key" in str(e).lower() or "authentication" in str(e).lower():
            error_message = "⚠️ There's an issue with the AI configuration. Please check the API key settings."
        elif "rate" in str(e).lower():
            error_message = "⏳ Too many requests. Please wait a moment and try again."
        elif "mautic" in str(e).lower():
            error_message = "⚠️ There's an issue connecting to Mautic. Please check your CRM connection settings."

        return ChatResponse(
            response=error_message,
            message=str(e),
            status="error"
        )


@router.get("/chat/status", deprecated=True)
async def chat_status():
    """
    Check chat service status and configuration.

    Returns status information about the AI chat service.
    """
    return {
        "status": "operational",
        "ai_configured": bool(settings.ANTHROPIC_API_KEY),
        "model": settings.SYNTHESIS_MODEL if settings.ANTHROPIC_API_KEY else None,
        "tools_available": len(MAUTIC_READ_TOOLS) + len(MAUTIC_WRITE_TOOLS),
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/chat/tools", deprecated=True)
async def list_tools():
    """
    List all available Mautic tools.

    Returns the tool definitions that Claude can use.
    """
    return {
        "read_tools": [
            {"name": t["name"], "description": t["description"]}
            for t in MAUTIC_READ_TOOLS
        ],
        "write_tools": [
            {"name": t["name"], "description": t["description"]}
            for t in MAUTIC_WRITE_TOOLS
        ],
        "total": len(MAUTIC_READ_TOOLS) + len(MAUTIC_WRITE_TOOLS),
    }
