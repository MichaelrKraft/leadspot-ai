"""
Chat routes for LeadSpot AI Command Center

Handles natural language commands from the Mautic plugin.
This is the main entry point for the AI agent system with full tool calling support.
"""

import json
import logging
from datetime import datetime
from typing import Any, Optional

from anthropic import AsyncAnthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.organization import Organization
from app.services.mautic_client import MauticClient, MauticAuthError
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
    mautic_url: Optional[str] = Field(None, description="Mautic instance URL for context")
    organization_id: Optional[str] = Field(None, description="Organization ID for Mautic API access")
    enable_tools: bool = Field(True, description="Enable Mautic tool calling")


class ToolCall(BaseModel):
    """Represents a tool call made by the AI"""
    tool_name: str
    tool_input: dict
    result: Optional[dict] = None


class ChatResponse(BaseModel):
    """Response model for chat messages"""
    response: str = Field(..., description="AI agent's response")
    message: Optional[str] = Field(None, description="Alternative response field for compatibility")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    status: str = Field(default="success")
    tools_used: list[str] = Field(default_factory=list, description="List of tools that were used")
    tool_results: Optional[list[dict]] = Field(None, description="Results from tool calls")


# System prompt for the AI agent with tool calling
SYSTEM_PROMPT = """You are LeadSpot AI, an autonomous marketing agent embedded in Mautic CRM.

Your role is to help users execute marketing tasks through natural language commands. You have direct access to the Mautic CRM API through tools.

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


async def get_mautic_client_for_org(
    organization_id: str,
    session: AsyncSession,
) -> Optional[MauticClient]:
    """Get a MauticClient for the organization if Mautic is connected."""
    try:
        return await MauticClient.from_organization(organization_id, session)
    except MauticAuthError:
        return None


async def run_tool_loop(
    client: AsyncAnthropic,
    messages: list[dict],
    tools: list[dict],
    mautic_client: MauticClient,
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
            system=SYSTEM_PROMPT,
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

                # Execute the tool
                result = await execute_tool(tool_name, tool_input, mautic_client)
                tool_results.append({
                    "tool": tool_name,
                    "input": tool_input,
                    "success": result.get("success"),
                    "display": format_tool_result_for_display(tool_name, result),
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


@router.post("/chat", response_model=ChatResponse)
async def process_chat(
    request: ChatRequest,
    session: AsyncSession = Depends(get_db),
):
    """
    Process a chat message from the Mautic plugin.

    This endpoint receives natural language commands and returns AI-generated responses.
    When Mautic is connected, the AI can use tools to read and write CRM data.

    - **message**: User's natural language command
    - **mautic_url**: (Optional) The Mautic instance URL for context
    - **organization_id**: (Optional) Organization ID for authenticated Mautic access
    - **enable_tools**: Enable/disable tool calling (default: true)

    Returns an AI response with optional tool call results.
    """
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

        if request.enable_tools and request.organization_id:
            mautic_client = await get_mautic_client_for_org(
                request.organization_id,
                session,
            )

            if mautic_client:
                # Enable all Mautic tools
                tools = MAUTIC_READ_TOOLS + MAUTIC_WRITE_TOOLS
                logger.info(f"Mautic tools enabled for org {request.organization_id}")
            else:
                logger.info(f"No Mautic connection for org {request.organization_id}")

        # Also try to find organization by mautic_url if no org_id provided
        if not mautic_client and request.enable_tools and request.mautic_url:
            # Try to find org by Mautic URL
            result = await session.execute(
                select(Organization).where(
                    Organization.mautic_url == request.mautic_url.rstrip("/")
                )
            )
            org = result.scalar_one_or_none()

            if org and org.mautic_access_token:
                try:
                    mautic_client = await MauticClient.from_organization(
                        org.organization_id,
                        session,
                    )
                    tools = MAUTIC_READ_TOOLS + MAUTIC_WRITE_TOOLS
                    logger.info(f"Mautic tools enabled via URL match for org {org.organization_id}")
                except MauticAuthError as e:
                    logger.warning(f"Could not create Mautic client: {e}")

        # Build initial messages
        messages = [{"role": "user", "content": request.message}]

        # Add context about Mautic connection status
        if mautic_client:
            context_note = f"\n\n[System: Mautic is connected at {mautic_client.mautic_url}. You have full API access.]"
            messages[0]["content"] += context_note
        elif request.mautic_url:
            context_note = f"\n\n[System: User is in Mautic at {request.mautic_url}, but API access is not configured. You can only provide advice, not execute actions.]"
            messages[0]["content"] += context_note

        # Run the conversation (with or without tools)
        if mautic_client and tools:
            # Full tool calling mode
            response_text, tools_used, tool_results = await run_tool_loop(
                client=client,
                messages=messages,
                tools=tools,
                mautic_client=mautic_client,
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
                system=SYSTEM_PROMPT,
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
        logger.exception(f"Error processing chat: {str(e)}")

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


@router.get("/chat/status")
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


@router.get("/chat/tools")
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
