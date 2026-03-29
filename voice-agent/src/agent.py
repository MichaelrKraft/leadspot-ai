"""
LeadSpot Voice AI Agent
=======================
LiveKit-powered voice assistant for LeadSpot CRM with:
- Built-in actions: Book appointments, Save contacts, Send SMS, Qualify leads
- Dynamic HTTP tools: User-configured API endpoints from dashboard
- Custom variables: Personalized prompts with {{variable}} substitution
"""

import asyncio
import os
import json
import re
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional
from dotenv import load_dotenv
import dateparser
import httpx

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    WorkerOptions,
    function_tool,
    cli,
)
from livekit.plugins import deepgram, openai, silero
from twilio.rest import Client as TwilioClient

load_dotenv()


# ═══════════════════════════════════════════════════════════════════════════════
# DYNAMIC TOOL CREATION
# ═══════════════════════════════════════════════════════════════════════════════

def create_dynamic_http_tool(tool_config: Dict[str, Any]) -> Callable:
    """
    Create a function_tool from user-configured HTTP tool.

    This allows users to define custom API endpoints in the dashboard
    that the voice agent can call during conversations.
    """
    tool_name = tool_config.get('name', 'custom_tool').lower().replace(' ', '_')
    tool_description = tool_config.get('description', 'A custom HTTP tool')
    url = tool_config.get('url', '')
    method = tool_config.get('method', 'POST')
    headers = tool_config.get('headers', {})
    body_template = tool_config.get('bodyTemplate', '')
    parameters = tool_config.get('parameters', [])

    # Build parameter documentation for the AI
    param_docs = []
    for param in parameters:
        param_type = param.get('type', 'string')
        required = 'required' if param.get('required', True) else 'optional'
        param_docs.append(f"        {param['name']}: {param.get('description', '')} ({param_type}, {required})")

    params_str = '\n'.join(param_docs) if param_docs else '        None'

    @function_tool
    async def dynamic_tool(**kwargs) -> str:
        """Dynamic HTTP tool - description set below."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Build the request body from template
                body = body_template
                for key, value in kwargs.items():
                    body = body.replace(f'{{{{{key}}}}}', str(value))

                # Make the HTTP request
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    json=json.loads(body) if body else None,
                )

                if response.status_code >= 400:
                    return f"The request failed with status {response.status_code}"

                # Try to parse as JSON for cleaner response
                try:
                    result = response.json()
                    if isinstance(result, dict):
                        # Return a summary if it's a complex object
                        if 'message' in result:
                            return result['message']
                        elif 'status' in result:
                            return f"Success: {result.get('status')}"
                    return f"Request completed successfully"
                except:
                    return f"Request completed: {response.text[:200]}"

        except httpx.TimeoutException:
            return "The request timed out. Please try again."
        except Exception as e:
            return f"There was an error: {str(e)}"

    # Set the function's metadata for the AI
    dynamic_tool.__doc__ = f"""{tool_description}

    Args:
{params_str}
    """
    dynamic_tool.__name__ = tool_name

    return dynamic_tool


def substitute_variables(text: str, variables: Dict[str, str]) -> str:
    """Replace {{variable}} placeholders with their values."""
    if not text:
        return text

    result = text
    for key, value in variables.items():
        result = result.replace(f'{{{{{key}}}}}', str(value))

    return result


# ═══════════════════════════════════════════════════════════════════════════════
# AGENT CONFIGURATION LOADER
# ═══════════════════════════════════════════════════════════════════════════════

async def load_agent_config(agent_id: str) -> Optional[Dict[str, Any]]:
    """
    Load agent configuration from the dashboard API.

    In production, this fetches from the real API.
    For development, returns mock data.
    """
    dashboard_url = os.getenv('DASHBOARD_URL', 'http://localhost:3005')

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{dashboard_url}/api/voice/agents/{agent_id}")
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        print(f"Failed to load agent config: {e}")

    # Return default config if API fails
    return {
        'name': 'Default Agent',
        'systemPrompt': 'You are a helpful voice assistant.',
        'welcomeMessage': 'Hello! How can I help you today?',
        'allowInterruption': True,
        'voiceId': 'rachel',
        'config': {
            'customVariables': [],
            'httpTools': [],
            'mcpServers': [],
        }
    }


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN VOICE AGENT
# ═══════════════════════════════════════════════════════════════════════════════

class LeadSpotVoiceAssistant(Agent):
    """
    Voice assistant with built-in and dynamic actions.

    Built-in actions:
    - book_appointment: Schedule via Google Calendar
    - save_contact: Save to Mautic CRM
    - send_text_message: Send SMS via Twilio
    - qualify_lead: Lead qualification scoring

    Dynamic actions:
    - User-configured HTTP tools from dashboard
    """

    def __init__(
        self,
        system_prompt: str = None,
        welcome_message: str = None,
        custom_variables: Dict[str, str] = None,
        http_tools: List[Dict] = None,
    ) -> None:
        # Build variables dict with built-ins
        self.variables = {
            'current_date': datetime.now().strftime('%B %d, %Y'),
            'current_time': datetime.now().strftime('%I:%M %p'),
            'agent_name': 'Voice Assistant',
            'company_name': os.getenv('COMPANY_NAME', 'Our Company'),
        }

        # Add custom variables
        if custom_variables:
            for var in custom_variables:
                if isinstance(var, dict) and 'key' in var and 'value' in var:
                    self.variables[var['key']] = var['value']

        # Substitute variables in system prompt
        instructions = system_prompt or """You are a helpful assistant for LeadSpot CRM.
        You can:
        - Book appointments on the calendar
        - Save contact information to the CRM
        - Send text message confirmations
        - Qualify leads by asking about budget, timeline, and needs

        Be friendly, professional, and concise.
        Always confirm important details before taking actions."""

        instructions = substitute_variables(instructions, self.variables)

        super().__init__(instructions=instructions)

        # Store welcome message
        self.welcome_message = substitute_variables(
            welcome_message or "Hello! How can I help you today?",
            self.variables
        )

        # Store HTTP tools for dynamic registration
        self.http_tools = http_tools or []

        # Initialize Twilio client for SMS
        twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
        twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
        if twilio_sid and twilio_token:
            self.twilio = TwilioClient(twilio_sid, twilio_token)
        else:
            self.twilio = None
        self.twilio_number = os.getenv("TWILIO_PHONE_NUMBER")

        # Mautic CRM config
        self.mautic_url = os.getenv("MAUTIC_API_URL")
        self.mautic_token = os.getenv("MAUTIC_ACCESS_TOKEN")

        # Google Calendar credentials path
        self.google_creds_path = os.getenv("GOOGLE_CREDENTIALS_PATH", "google_creds.json")

        # Store caller info during conversation
        self.caller_phone = None
        self.caller_name = None
        self.caller_email = None

    def get_dynamic_tools(self) -> List[Callable]:
        """Create dynamic tools from HTTP tool configurations."""
        tools = []
        for tool_config in self.http_tools:
            try:
                tool = create_dynamic_http_tool(tool_config)
                tools.append(tool)
            except Exception as e:
                print(f"Failed to create tool '{tool_config.get('name', 'unknown')}': {e}")
        return tools

    # ═══════════════════════════════════════════════════════════════════════
    # ACTION 1: BOOK APPOINTMENTS (Google Calendar)
    # ═══════════════════════════════════════════════════════════════════════

    @function_tool
    async def book_appointment(
        self,
        date: str,
        time: str,
        purpose: str,
        duration_minutes: int = 30
    ) -> str:
        """Book an appointment on Google Calendar.

        Args:
            date: The date (e.g., "Tuesday", "December 24", "tomorrow")
            time: The time (e.g., "2:00 PM", "14:00")
            purpose: What the meeting is about
            duration_minutes: Meeting duration (default 30 minutes)
        """
        try:
            # Parse natural language date/time
            combined = f"{date} {time}"
            appointment_dt = dateparser.parse(combined, settings={
                'PREFER_DATES_FROM': 'future',
                'RELATIVE_BASE': datetime.now()
            })

            if not appointment_dt:
                return "I couldn't understand that date/time. Could you say it differently?"

            # Import Google Calendar API (lazy import)
            try:
                from google.oauth2.credentials import Credentials
                from googleapiclient.discovery import build
            except ImportError:
                return "Calendar integration not configured. I've noted your request."

            # Check if credentials file exists
            if not os.path.exists(self.google_creds_path):
                return f"Appointment noted for {appointment_dt.strftime('%A, %B %d at %I:%M %p')}. Calendar sync pending setup."

            # Create Google Calendar event
            creds = Credentials.from_authorized_user_file(self.google_creds_path)
            service = build('calendar', 'v3', credentials=creds)

            event = {
                'summary': f'Call with {self.caller_name or "Lead"}',
                'description': f'Purpose: {purpose}\nPhone: {self.caller_phone or "N/A"}',
                'start': {
                    'dateTime': appointment_dt.isoformat(),
                    'timeZone': 'America/New_York',
                },
                'end': {
                    'dateTime': (appointment_dt + timedelta(minutes=duration_minutes)).isoformat(),
                    'timeZone': 'America/New_York',
                },
                'reminders': {
                    'useDefault': False,
                    'overrides': [
                        {'method': 'email', 'minutes': 60},
                        {'method': 'popup', 'minutes': 30},
                    ],
                },
            }

            if self.caller_email:
                event['attendees'] = [{'email': self.caller_email}]

            service.events().insert(
                calendarId='primary',
                body=event,
                sendUpdates='all'
            ).execute()

            formatted_date = appointment_dt.strftime("%A, %B %d at %I:%M %p")
            return f"Appointment booked for {formatted_date}. Would you like me to send you a text confirmation?"

        except Exception as e:
            return f"I had trouble booking that appointment: {str(e)}"

    # ═══════════════════════════════════════════════════════════════════════
    # ACTION 2: SAVE CONTACT TO CRM (Mautic)
    # ═══════════════════════════════════════════════════════════════════════

    @function_tool
    async def save_contact(
        self,
        name: str,
        phone: str,
        email: str = None,
        notes: str = None
    ) -> str:
        """Save or update a contact in the CRM.

        Args:
            name: The contact's full name
            phone: The contact's phone number
            email: The contact's email address (optional)
            notes: Any notes about this contact (optional)
        """
        try:
            # Store for use in other tools and variables
            self.caller_name = name
            self.caller_phone = phone
            self.caller_email = email
            self.variables['caller_name'] = name
            self.variables['caller_phone'] = phone
            if email:
                self.variables['caller_email'] = email

            # Parse name
            name_parts = name.split()
            firstname = name_parts[0]
            lastname = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

            if not self.mautic_url or not self.mautic_token:
                return f"Got it! I've noted your information, {firstname}."

            async with httpx.AsyncClient() as client:
                # Check if contact exists by phone
                search_resp = await client.get(
                    f"{self.mautic_url}/api/contacts",
                    params={"search": phone},
                    headers={"Authorization": f"Bearer {self.mautic_token}"}
                )
                existing = search_resp.json().get("contacts", {})

                contact_data = {
                    "firstname": firstname,
                    "lastname": lastname,
                    "phone": phone,
                    "tags": ["voice-lead", "inbound-call"],
                }
                if email:
                    contact_data["email"] = email

                if existing:
                    contact_id = list(existing.keys())[0]
                    await client.patch(
                        f"{self.mautic_url}/api/contacts/{contact_id}/edit",
                        json=contact_data,
                        headers={"Authorization": f"Bearer {self.mautic_token}"}
                    )
                else:
                    resp = await client.post(
                        f"{self.mautic_url}/api/contacts/new",
                        json=contact_data,
                        headers={"Authorization": f"Bearer {self.mautic_token}"}
                    )
                    result = resp.json()
                    contact_id = result.get("contact", {}).get("id")

                if notes and contact_id:
                    await client.post(
                        f"{self.mautic_url}/api/notes/new",
                        json={
                            "lead": contact_id,
                            "text": f"[Voice Call] {notes}",
                            "type": "general"
                        },
                        headers={"Authorization": f"Bearer {self.mautic_token}"}
                    )

                return f"Got it! I've saved your information, {firstname}."

        except Exception:
            return f"I've noted your information, {name}."

    # ═══════════════════════════════════════════════════════════════════════
    # ACTION 3: SEND SMS (Twilio)
    # ═══════════════════════════════════════════════════════════════════════

    @function_tool
    async def send_text_message(
        self,
        message: str,
        phone_number: str = None
    ) -> str:
        """Send a text message to the caller.

        Args:
            message: The text message content to send
            phone_number: Phone number to send to (uses caller's number if not specified)
        """
        try:
            to_number = phone_number or self.caller_phone

            if not to_number:
                return "I need a phone number to send the text. What's the best number?"

            if not self.twilio or not self.twilio_number:
                return f"I've noted to send you: '{message}'"

            self.twilio.messages.create(
                body=message,
                from_=self.twilio_number,
                to=to_number
            )

            return f"Done! I just sent a text to {to_number}."

        except Exception:
            return "I had trouble sending that text. Let me make a note instead."

    # ═══════════════════════════════════════════════════════════════════════
    # ACTION 4: QUALIFY LEAD
    # ═══════════════════════════════════════════════════════════════════════

    @function_tool
    async def qualify_lead(
        self,
        budget: str,
        timeline: str,
        needs: str
    ) -> str:
        """Record lead qualification information.

        Args:
            budget: The lead's budget range
            timeline: When they need the solution
            needs: What they're looking for
        """
        try:
            qualification = f"Budget: {budget}, Timeline: {timeline}, Needs: {needs}"
            budget_lower = budget.lower()
            is_qualified = not any(x in budget_lower for x in ["none", "no budget", "0", "zero", "nothing"])

            if self.caller_phone and self.mautic_url and self.mautic_token:
                async with httpx.AsyncClient() as client:
                    search_resp = await client.get(
                        f"{self.mautic_url}/api/contacts",
                        params={"search": self.caller_phone},
                        headers={"Authorization": f"Bearer {self.mautic_token}"}
                    )
                    existing = search_resp.json().get("contacts", {})

                    if existing:
                        contact_id = list(existing.keys())[0]
                        status = "QUALIFIED" if is_qualified else "NOT QUALIFIED"

                        await client.post(
                            f"{self.mautic_url}/api/notes/new",
                            json={
                                "lead": contact_id,
                                "text": f"[Voice Qualification] {qualification}\nStatus: {status}",
                                "type": "general"
                            },
                            headers={"Authorization": f"Bearer {self.mautic_token}"}
                        )

                        tag = "qualified-lead" if is_qualified else "not-qualified"
                        await client.patch(
                            f"{self.mautic_url}/api/contacts/{contact_id}/edit",
                            json={"tags": [tag]},
                            headers={"Authorization": f"Bearer {self.mautic_token}"}
                        )

            if is_qualified:
                return "Great! Based on what you've told me, I think we can definitely help. Would you like to schedule a consultation?"
            else:
                return "Thanks for sharing that. Let me make a note and someone from our team will follow up."

        except Exception:
            return "I've noted your requirements. Would you like to schedule a call to discuss further?"

    # ═══════════════════════════════════════════════════════════════════════
    # UTILITY: Get current date/time
    # ═══════════════════════════════════════════════════════════════════════

    @function_tool
    async def get_current_datetime(self) -> str:
        """Get the current date and time."""
        return datetime.now().strftime("%A, %B %d, %Y at %I:%M %p")


# ═══════════════════════════════════════════════════════════════════════════════
# ELEVENLABS VOICE MAPPING
# ═══════════════════════════════════════════════════════════════════════════════

ELEVENLABS_VOICE_IDS = {
    # Female voices
    'rachel': '21m00Tcm4TlvDq8ikWAM',
    'sarah': 'EXAVITQu4vr4xnSDxMaL',
    'charlotte': 'XB0fDUnXU5powFXDhCwa',
    'matilda': 'XrExE9yKIg1WjnnlVkGX',
    # Male voices
    'josh': 'TxGEqnHWrfWFTfGW9XjX',
    'adam': 'pNInz6obpgDQGcFmaJgB',
    'antoni': 'ErXwobaYiN019PkySvjV',
    'brian': 'nPczCjzI2devNBz1zQrb',
}


# ═══════════════════════════════════════════════════════════════════════════════
# ENTRYPOINT
# ═══════════════════════════════════════════════════════════════════════════════

async def entrypoint(ctx: JobContext):
    """Entry point for the voice agent."""

    # Connect to the room first
    await ctx.connect()

    # Parse room metadata for agent configuration
    agent_id = None
    caller_phone = None
    agent_config = None

    if ctx.room.metadata:
        try:
            metadata = json.loads(ctx.room.metadata)
            agent_id = metadata.get("agentId")
            caller_phone = metadata.get("phoneNumber")
        except json.JSONDecodeError:
            pass

    # Load agent configuration from dashboard
    if agent_id:
        agent_config = await load_agent_config(agent_id)
    else:
        agent_config = await load_agent_config("default")

    # Extract configuration values
    config = agent_config.get('config', {})
    system_prompt = agent_config.get('systemPrompt', '')
    welcome_message = config.get('welcomeMessage', agent_config.get('welcomeMessage', ''))
    custom_variables = config.get('customVariables', [])
    http_tools = config.get('httpTools', [])
    voice_id = agent_config.get('voiceId', 'rachel')

    # Use ElevenLabs TTS with voice from agent config
    from livekit.plugins import elevenlabs
    elevenlabs_voice_id = ELEVENLABS_VOICE_IDS.get(voice_id, ELEVENLABS_VOICE_IDS['rachel'])
    tts = elevenlabs.TTS(voice_id=elevenlabs_voice_id)

    # Create agent session with voice pipeline
    session = AgentSession(
        stt=deepgram.STT(model="nova-2"),
        llm=openai.LLM(model="gpt-4"),
        tts=tts,
        vad=silero.VAD.load(),
    )

    # Create agent instance with configuration
    agent = LeadSpotVoiceAssistant(
        system_prompt=system_prompt,
        welcome_message=welcome_message,
        custom_variables=custom_variables,
        http_tools=http_tools,
    )

    # Set caller phone if available
    if caller_phone:
        agent.caller_phone = caller_phone
        agent.variables['caller_phone'] = caller_phone

    # Start the session
    await session.start(
        room=ctx.room,
        agent=agent,
    )

    # Recording consent announcement (legal requirement for recorded calls)
    await session.generate_reply(
        instructions="Say exactly this: 'This call may be recorded for quality and training purposes.'"
    )

    # Generate initial greeting using configured welcome message
    await session.generate_reply(
        instructions=f"Say exactly this greeting: {agent.welcome_message}"
    )

    # Mid-call balance check — terminate call gracefully if balance runs out
    dashboard_url = os.getenv("DASHBOARD_URL", "http://localhost:3005")
    tenant_id = None
    call_id = None
    if ctx.room.metadata:
        try:
            meta = json.loads(ctx.room.metadata)
            tenant_id = meta.get("tenantId")
            call_id = meta.get("callId")
        except (json.JSONDecodeError, AttributeError):
            pass

    async def check_balance_loop():
        """Check tenant balance every 60s and terminate call if insufficient."""
        while True:
            await asyncio.sleep(60)
            if not tenant_id or not call_id:
                continue
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(
                        f"{dashboard_url}/api/billing/balance-check",
                        params={"tenantId": tenant_id, "callId": call_id},
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        if not data.get("shouldContinue", True):
                            await session.generate_reply(
                                instructions="Say exactly this: 'I apologize, but we need to end this call. Your account balance is insufficient to continue. Please add credits to your account to make future calls. Thank you and have a great day.'"
                            )
                            await ctx.room.disconnect()
                            return
            except Exception as e:
                print(f"[BalanceCheck] Error checking balance: {e}")

    asyncio.ensure_future(check_balance_loop())


if __name__ == "__main__":
    cli.run_app(WorkerOptions(
        entrypoint_fnc=entrypoint,
        agent_name="leadspot-voice-agent",
    ))
