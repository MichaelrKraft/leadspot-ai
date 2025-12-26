"""
Mautic Tools for Claude Tool Calling

Defines the tools that Claude can use to interact with Mautic CRM.
Each tool has a definition (for Claude) and an execution handler.
"""

import logging
from typing import Any, Callable

from app.services.mautic_client import MauticClient, MauticAPIError, MauticAuthError

logger = logging.getLogger(__name__)


# =============================================================================
# Tool Definitions (for Claude API)
# =============================================================================

MAUTIC_READ_TOOLS = [
    # Contact Tools
    {
        "name": "get_contacts",
        "description": "Get a list of contacts from Mautic CRM. Use this to browse or search contacts. Returns contact names, emails, companies, and engagement scores.",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of contacts to return (1-100, default 30)",
                    "default": 30,
                },
                "search": {
                    "type": "string",
                    "description": "Search query to filter contacts. Can search by name, email, company, or use Mautic search syntax like 'email:*@company.com' or 'tag:hot-lead'",
                },
                "order_by": {
                    "type": "string",
                    "enum": ["date_added", "last_active", "points", "firstname", "lastname", "email"],
                    "description": "Field to sort by",
                    "default": "date_added",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_contact",
        "description": "Get detailed information about a specific contact by their ID. Returns full profile including custom fields, tags, and activity summary.",
        "input_schema": {
            "type": "object",
            "properties": {
                "contact_id": {
                    "type": "integer",
                    "description": "The Mautic contact ID",
                },
            },
            "required": ["contact_id"],
        },
    },
    {
        "name": "get_contact_activity",
        "description": "Get the activity timeline for a contact. Shows email opens, page visits, form submissions, and other engagement events.",
        "input_schema": {
            "type": "object",
            "properties": {
                "contact_id": {
                    "type": "integer",
                    "description": "The Mautic contact ID",
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of events to return (default 25)",
                    "default": 25,
                },
            },
            "required": ["contact_id"],
        },
    },
    
    # Email Tools
    {
        "name": "get_emails",
        "description": "Get a list of email templates and campaigns from Mautic. Returns email names, subjects, and basic statistics.",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of emails to return (1-100, default 30)",
                    "default": 30,
                },
                "search": {
                    "type": "string",
                    "description": "Search query to filter emails by name or subject",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_email",
        "description": "Get detailed information about a specific email including content, statistics, and send history.",
        "input_schema": {
            "type": "object",
            "properties": {
                "email_id": {
                    "type": "integer",
                    "description": "The Mautic email ID",
                },
            },
            "required": ["email_id"],
        },
    },
    
    # Campaign Tools
    {
        "name": "get_campaigns",
        "description": "Get a list of campaigns (automation workflows) from Mautic. Returns campaign names, status, and contact counts.",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of campaigns to return (1-100, default 30)",
                    "default": 30,
                },
                "search": {
                    "type": "string",
                    "description": "Search query to filter campaigns by name",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_campaign",
        "description": "Get detailed information about a specific campaign including events, triggers, and statistics.",
        "input_schema": {
            "type": "object",
            "properties": {
                "campaign_id": {
                    "type": "integer",
                    "description": "The Mautic campaign ID",
                },
            },
            "required": ["campaign_id"],
        },
    },
    
    # Segment Tools
    {
        "name": "get_segments",
        "description": "Get a list of contact segments from Mautic. Returns segment names and contact counts.",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of segments to return (1-100, default 30)",
                    "default": 30,
                },
            },
            "required": [],
        },
    },
    
    # Summary Tools
    {
        "name": "get_summary_stats",
        "description": "Get a quick overview of the Mautic instance with total counts of contacts, emails, campaigns, and segments.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
]


MAUTIC_WRITE_TOOLS = [
    # Contact Write Tools
    {
        "name": "create_contact",
        "description": "Create a new contact in Mautic. Requires at least an email address.",
        "input_schema": {
            "type": "object",
            "properties": {
                "email": {
                    "type": "string",
                    "description": "Contact's email address (required)",
                },
                "firstname": {
                    "type": "string",
                    "description": "Contact's first name",
                },
                "lastname": {
                    "type": "string",
                    "description": "Contact's last name",
                },
                "company": {
                    "type": "string",
                    "description": "Contact's company name",
                },
                "phone": {
                    "type": "string",
                    "description": "Contact's phone number",
                },
            },
            "required": ["email"],
        },
    },
    {
        "name": "update_contact",
        "description": "Update an existing contact's information.",
        "input_schema": {
            "type": "object",
            "properties": {
                "contact_id": {
                    "type": "integer",
                    "description": "The Mautic contact ID to update",
                },
                "email": {
                    "type": "string",
                    "description": "New email address",
                },
                "firstname": {
                    "type": "string",
                    "description": "New first name",
                },
                "lastname": {
                    "type": "string",
                    "description": "New last name",
                },
                "company": {
                    "type": "string",
                    "description": "New company name",
                },
                "phone": {
                    "type": "string",
                    "description": "New phone number",
                },
            },
            "required": ["contact_id"],
        },
    },
    {
        "name": "add_tag",
        "description": "Add a tag to a contact. Tags help categorize and segment contacts.",
        "input_schema": {
            "type": "object",
            "properties": {
                "contact_id": {
                    "type": "integer",
                    "description": "The Mautic contact ID",
                },
                "tag": {
                    "type": "string",
                    "description": "The tag to add (e.g., 'hot-lead', 'webinar-attended')",
                },
            },
            "required": ["contact_id", "tag"],
        },
    },
    {
        "name": "remove_tag",
        "description": "Remove a tag from a contact.",
        "input_schema": {
            "type": "object",
            "properties": {
                "contact_id": {
                    "type": "integer",
                    "description": "The Mautic contact ID",
                },
                "tag": {
                    "type": "string",
                    "description": "The tag to remove",
                },
            },
            "required": ["contact_id", "tag"],
        },
    },
    {
        "name": "add_note",
        "description": "Add a note to a contact's timeline.",
        "input_schema": {
            "type": "object",
            "properties": {
                "contact_id": {
                    "type": "integer",
                    "description": "The Mautic contact ID",
                },
                "note": {
                    "type": "string",
                    "description": "The note content to add",
                },
            },
            "required": ["contact_id", "note"],
        },
    },
    {
        "name": "add_to_segment",
        "description": "Add a contact to a segment.",
        "input_schema": {
            "type": "object",
            "properties": {
                "contact_id": {
                    "type": "integer",
                    "description": "The Mautic contact ID",
                },
                "segment_id": {
                    "type": "integer",
                    "description": "The segment ID to add the contact to",
                },
            },
            "required": ["contact_id", "segment_id"],
        },
    },
    {
        "name": "add_to_campaign",
        "description": "Add a contact to a campaign (automation workflow).",
        "input_schema": {
            "type": "object",
            "properties": {
                "contact_id": {
                    "type": "integer",
                    "description": "The Mautic contact ID",
                },
                "campaign_id": {
                    "type": "integer",
                    "description": "The campaign ID to add the contact to",
                },
            },
            "required": ["contact_id", "campaign_id"],
        },
    },
    
    # Email Write Tools
    {
        "name": "create_email",
        "description": "Create a new email template in Mautic.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Internal name for the email",
                },
                "subject": {
                    "type": "string",
                    "description": "Email subject line",
                },
                "body": {
                    "type": "string",
                    "description": "HTML body content of the email",
                },
                "from_name": {
                    "type": "string",
                    "description": "Sender name (optional)",
                },
            },
            "required": ["name", "subject", "body"],
        },
    },
    {
        "name": "send_email_to_contact",
        "description": "Send an email to a specific contact.",
        "input_schema": {
            "type": "object",
            "properties": {
                "email_id": {
                    "type": "integer",
                    "description": "The Mautic email ID to send",
                },
                "contact_id": {
                    "type": "integer",
                    "description": "The contact ID to send the email to",
                },
            },
            "required": ["email_id", "contact_id"],
        },
    },
    
    # Campaign Write Tools
    {
        "name": "create_campaign",
        "description": "Create a new campaign (automation workflow) in Mautic.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Campaign name",
                },
                "description": {
                    "type": "string",
                    "description": "Campaign description",
                },
            },
            "required": ["name"],
        },
    },
    {
        "name": "publish_campaign",
        "description": "Publish a campaign to make it active and start processing contacts.",
        "input_schema": {
            "type": "object",
            "properties": {
                "campaign_id": {
                    "type": "integer",
                    "description": "The campaign ID to publish",
                },
            },
            "required": ["campaign_id"],
        },
    },
    
    # Segment Write Tools
    {
        "name": "create_segment",
        "description": "Create a new contact segment in Mautic.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Segment name",
                },
                "description": {
                    "type": "string",
                    "description": "Segment description",
                },
            },
            "required": ["name"],
        },
    },

    # Lead Scoring Tools
    {
        "name": "score_lead",
        "description": "Calculate engagement score for a contact and optionally apply a lead tier tag (hot-lead, warm-lead, or cold-lead). The score combines Mautic points with activity analysis and recency weighting.",
        "input_schema": {
            "type": "object",
            "properties": {
                "contact_id": {
                    "type": "integer",
                    "description": "The Mautic contact ID to score",
                },
                "auto_tag": {
                    "type": "boolean",
                    "description": "Whether to automatically apply tier tags (default: true)",
                    "default": True,
                },
            },
            "required": ["contact_id"],
        },
    },
]


# All tools combined
ALL_MAUTIC_TOOLS = MAUTIC_READ_TOOLS + MAUTIC_WRITE_TOOLS


# =============================================================================
# Tool Execution Handlers
# =============================================================================

async def execute_tool(
    tool_name: str,
    tool_input: dict,
    mautic_client: MauticClient,
) -> dict[str, Any]:
    """
    Execute a Mautic tool and return the result.
    
    Args:
        tool_name: Name of the tool to execute
        tool_input: Input parameters for the tool
        mautic_client: Configured MauticClient instance
        
    Returns:
        Dictionary with success status and result/error
    """
    try:
        result = await _dispatch_tool(tool_name, tool_input, mautic_client)
        return {
            "success": True,
            "result": result,
        }
    except MauticAuthError as e:
        logger.error(f"Mautic auth error in {tool_name}: {e}")
        return {
            "success": False,
            "error": f"Authentication error: {str(e)}",
            "error_type": "auth",
        }
    except MauticAPIError as e:
        logger.error(f"Mautic API error in {tool_name}: {e}")
        return {
            "success": False,
            "error": f"API error: {str(e)}",
            "error_type": "api",
            "status_code": e.status_code,
        }
    except Exception as e:
        logger.exception(f"Unexpected error in {tool_name}: {e}")
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "error_type": "unknown",
        }


async def _dispatch_tool(
    tool_name: str,
    tool_input: dict,
    client: MauticClient,
) -> Any:
    """Dispatch to the appropriate tool handler."""
    
    # Read tools
    if tool_name == "get_contacts":
        return await client.get_contacts(
            limit=tool_input.get("limit", 30),
            search=tool_input.get("search"),
            order_by=tool_input.get("order_by", "date_added"),
        )
    
    elif tool_name == "get_contact":
        return await client.get_contact(tool_input["contact_id"])
    
    elif tool_name == "get_contact_activity":
        return await client.get_contact_activity(
            tool_input["contact_id"],
            limit=tool_input.get("limit", 25),
        )
    
    elif tool_name == "get_emails":
        return await client.get_emails(
            limit=tool_input.get("limit", 30),
            search=tool_input.get("search"),
        )
    
    elif tool_name == "get_email":
        return await client.get_email(tool_input["email_id"])
    
    elif tool_name == "get_campaigns":
        return await client.get_campaigns(
            limit=tool_input.get("limit", 30),
            search=tool_input.get("search"),
        )
    
    elif tool_name == "get_campaign":
        return await client.get_campaign(tool_input["campaign_id"])
    
    elif tool_name == "get_segments":
        return await client.get_segments(
            limit=tool_input.get("limit", 30),
        )
    
    elif tool_name == "get_summary_stats":
        return await client.get_summary_stats()
    
    # Write tools
    elif tool_name == "create_contact":
        return await client.create_contact({
            "email": tool_input["email"],
            "firstname": tool_input.get("firstname"),
            "lastname": tool_input.get("lastname"),
            "company": tool_input.get("company"),
            "phone": tool_input.get("phone"),
        })
    
    elif tool_name == "update_contact":
        data = {}
        for field in ["email", "firstname", "lastname", "company", "phone"]:
            if field in tool_input:
                data[field] = tool_input[field]
        return await client.update_contact(tool_input["contact_id"], data)
    
    elif tool_name == "add_tag":
        return await client.add_contact_tag(
            tool_input["contact_id"],
            tool_input["tag"],
        )
    
    elif tool_name == "remove_tag":
        return await client.remove_contact_tag(
            tool_input["contact_id"],
            tool_input["tag"],
        )
    
    elif tool_name == "add_note":
        return await client.add_contact_note(
            tool_input["contact_id"],
            tool_input["note"],
        )
    
    elif tool_name == "add_to_segment":
        return await client.add_contact_to_segment(
            tool_input["segment_id"],
            tool_input["contact_id"],
        )
    
    elif tool_name == "add_to_campaign":
        return await client.add_contact_to_campaign(
            tool_input["campaign_id"],
            tool_input["contact_id"],
        )
    
    elif tool_name == "create_email":
        return await client.create_email(
            name=tool_input["name"],
            subject=tool_input["subject"],
            body=tool_input["body"],
            from_name=tool_input.get("from_name"),
        )
    
    elif tool_name == "send_email_to_contact":
        return await client.send_email_to_contact(
            tool_input["email_id"],
            tool_input["contact_id"],
        )
    
    elif tool_name == "create_campaign":
        return await client.create_campaign(
            name=tool_input["name"],
            description=tool_input.get("description"),
        )
    
    elif tool_name == "publish_campaign":
        return await client.publish_campaign(tool_input["campaign_id"])
    
    elif tool_name == "create_segment":
        return await client.create_segment(
            name=tool_input["name"],
            description=tool_input.get("description"),
        )

    # Lead Scoring tool
    elif tool_name == "score_lead":
        from app.services.lead_scoring_service import LeadScoringService
        scoring_service = LeadScoringService(client)
        auto_tag = tool_input.get("auto_tag", True)
        if auto_tag:
            return await scoring_service.score_and_tag(tool_input["contact_id"])
        else:
            return await scoring_service.calculate_score(tool_input["contact_id"])

    else:
        raise ValueError(f"Unknown tool: {tool_name}")


def format_tool_result_for_display(tool_name: str, result: dict) -> str:
    """
    Format a tool result for human-readable display.
    
    This is used to show users what data was retrieved.
    """
    if not result.get("success"):
        return f"❌ Error: {result.get('error', 'Unknown error')}"
    
    data = result.get("result", {})
    
    if tool_name == "get_contacts":
        contacts = data.get("contacts", {})
        total = data.get("total", 0)
        
        lines = [f"📋 Found {total} contacts"]
        for cid, contact in list(contacts.items())[:10]:
            fields = contact.get("fields", {}).get("all", contact.get("fields", {}))
            name = f"{fields.get('firstname', '')} {fields.get('lastname', '')}".strip()
            email = fields.get("email", "")
            points = contact.get("points", 0)
            lines.append(f"  • {name or 'Unknown'} ({email}) - {points} points")
        
        if len(contacts) > 10:
            lines.append(f"  ... and {len(contacts) - 10} more")
            
        return "\n".join(lines)
    
    elif tool_name == "get_contact":
        contact = data.get("contact", {})
        fields = contact.get("fields", {}).get("all", contact.get("fields", {}))
        
        lines = [
            f"👤 Contact Details",
            f"  Name: {fields.get('firstname', '')} {fields.get('lastname', '')}",
            f"  Email: {fields.get('email', '')}",
            f"  Company: {fields.get('company', '')}",
            f"  Phone: {fields.get('phone', '')}",
            f"  Points: {contact.get('points', 0)}",
        ]
        
        tags = contact.get("tags", [])
        if tags:
            tag_names = [t.get("tag", t) if isinstance(t, dict) else t for t in tags]
            lines.append(f"  Tags: {', '.join(tag_names)}")
            
        return "\n".join(lines)
    
    elif tool_name == "get_emails":
        emails = data.get("emails", {})
        total = data.get("total", 0)
        
        lines = [f"📧 Found {total} emails"]
        for eid, email in list(emails.items())[:10]:
            name = email.get("name", "Untitled")
            subject = email.get("subject", "")
            lines.append(f"  • {name}: \"{subject}\"")
            
        return "\n".join(lines)
    
    elif tool_name == "get_campaigns":
        campaigns = data.get("campaigns", {})
        total = data.get("total", 0)
        
        lines = [f"🔄 Found {total} campaigns"]
        for cid, campaign in list(campaigns.items())[:10]:
            name = campaign.get("name", "Untitled")
            published = "✅" if campaign.get("isPublished") else "📝"
            lines.append(f"  {published} {name}")
            
        return "\n".join(lines)
    
    elif tool_name == "get_segments":
        segments = data.get("lists", data.get("segments", {}))
        total = data.get("total", 0)
        
        lines = [f"👥 Found {total} segments"]
        for sid, segment in list(segments.items())[:10]:
            name = segment.get("name", "Untitled")
            lines.append(f"  • {name}")
            
        return "\n".join(lines)
    
    elif tool_name == "get_summary_stats":
        lines = [
            "📊 Mautic Summary",
            f"  Contacts: {data.get('total_contacts', 0)}",
            f"  Emails: {data.get('total_emails', 0)}",
            f"  Campaigns: {data.get('total_campaigns', 0)}",
            f"  Segments: {data.get('total_segments', 0)}",
        ]
        return "\n".join(lines)
    
    elif tool_name == "get_contact_activity":
        events = data.get("events", [])
        lines = [f"📅 Recent Activity ({len(events)} events)"]
        for event in events[:10]:
            event_type = event.get("event", "unknown")
            timestamp = event.get("timestamp", "")
            details = event.get("details", {})
            lines.append(f"  • {event_type}: {details} ({timestamp})")
        return "\n".join(lines)
    
    elif tool_name == "score_lead":
        tier = data.get("tier", "unknown")
        score = data.get("final_score", 0)
        tag = data.get("tag_applied", "")
        tier_emoji = {"hot": "🔥", "warm": "🌡️", "cold": "❄️"}.get(tier, "📊")

        lines = [
            f"{tier_emoji} Lead Score: {score} points ({tier.upper()} lead)",
            f"  Base Points: {data.get('base_points', 0)}",
            f"  Activity Score: {data.get('activity_score', 0)}",
            f"  Recency: {data.get('recency_category', 'unknown')} ({data.get('recency_multiplier', 1)}x)",
        ]
        if tag:
            lines.append(f"  Tag Applied: {tag}")
        return "\n".join(lines)

    # For write operations, return a simple success message
    elif tool_name in ["create_contact", "update_contact", "add_tag", "remove_tag",
                       "add_note", "add_to_segment", "add_to_campaign", "create_email",
                       "send_email_to_contact", "create_campaign", "publish_campaign",
                       "create_segment"]:
        return f"✅ Operation completed successfully"
    
    # Default
    return f"✅ Tool executed successfully"
