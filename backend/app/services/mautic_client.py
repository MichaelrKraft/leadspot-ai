"""
Mautic API Client Service

Real-time client for Mautic API operations during chat sessions.
Handles OAuth token management and provides methods for all Mautic operations.
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization

logger = logging.getLogger(__name__)


class MauticClientError(Exception):
    """Base exception for Mautic client errors"""
    pass


class MauticAuthError(MauticClientError):
    """Authentication/authorization error"""
    pass


class MauticAPIError(MauticClientError):
    """API request error"""
    def __init__(self, message: str, status_code: int = None, response_body: str = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body


class MauticClient:
    """
    Real-time Mautic API client for chat sessions.
    
    This client is designed to be instantiated per-request with organization
    credentials from the database. It handles token refresh automatically.
    """
    
    def __init__(
        self,
        mautic_url: str,
        access_token: str,
        refresh_token: Optional[str] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        token_expires_at: Optional[datetime] = None,
        session: Optional[AsyncSession] = None,
        organization_id: Optional[str] = None,
    ):
        self.mautic_url = mautic_url.rstrip("/")
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.client_id = client_id
        self.client_secret = client_secret
        self.token_expires_at = token_expires_at
        self.session = session
        self.organization_id = organization_id
        
    @classmethod
    async def from_organization(
        cls,
        organization_id: str,
        session: AsyncSession
    ) -> "MauticClient":
        """
        Create a MauticClient from organization credentials in the database.
        
        Args:
            organization_id: The organization's UUID
            session: Database session
            
        Returns:
            Configured MauticClient instance
            
        Raises:
            MauticAuthError: If organization has no Mautic connection
        """
        result = await session.execute(
            select(Organization).where(
                Organization.organization_id == organization_id
            )
        )
        org = result.scalar_one_or_none()
        
        if not org:
            raise MauticAuthError(f"Organization not found: {organization_id}")
            
        if not org.mautic_url or not org.mautic_access_token:
            raise MauticAuthError("Mautic is not connected for this organization")
            
        return cls(
            mautic_url=org.mautic_url,
            access_token=org.mautic_access_token,
            refresh_token=org.mautic_refresh_token,
            client_id=org.mautic_client_id,
            client_secret=org.mautic_client_secret,
            token_expires_at=org.mautic_token_expires_at,
            session=session,
            organization_id=organization_id,
        )
    
    async def _ensure_valid_token(self) -> None:
        """Refresh access token if expired or about to expire."""
        if not self.token_expires_at:
            return
            
        # Refresh if token expires in less than 5 minutes
        if datetime.utcnow() > self.token_expires_at - timedelta(minutes=5):
            await self._refresh_token()
    
    async def _refresh_token(self) -> None:
        """Refresh the OAuth access token."""
        if not self.refresh_token or not self.client_id or not self.client_secret:
            raise MauticAuthError("Cannot refresh token - missing credentials")
            
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.mautic_url}/oauth/v2/token",
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": self.refresh_token,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=30.0,
            )
            
            if response.status_code != 200:
                logger.error(f"Token refresh failed: {response.text}")
                raise MauticAuthError(f"Failed to refresh token: {response.status_code}")
                
            data = response.json()
            
            self.access_token = data["access_token"]
            self.refresh_token = data.get("refresh_token", self.refresh_token)
            expires_in = data.get("expires_in", 3600)
            self.token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            
            # Update database if we have a session
            if self.session and self.organization_id:
                result = await self.session.execute(
                    select(Organization).where(
                        Organization.organization_id == self.organization_id
                    )
                )
                org = result.scalar_one_or_none()
                if org:
                    org.mautic_access_token = self.access_token
                    org.mautic_refresh_token = self.refresh_token
                    org.mautic_token_expires_at = self.token_expires_at
                    await self.session.commit()
                    
            logger.info(f"Mautic token refreshed for org {self.organization_id}")
    
    async def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[dict] = None,
        json_data: Optional[dict] = None,
    ) -> dict:
        """
        Make an authenticated request to the Mautic API.
        
        Args:
            method: HTTP method (GET, POST, PATCH, DELETE)
            endpoint: API endpoint (e.g., "/api/contacts")
            params: Query parameters
            json_data: JSON body data
            
        Returns:
            Response JSON data
            
        Raises:
            MauticAPIError: If the request fails
        """
        await self._ensure_valid_token()
        
        url = f"{self.mautic_url}{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=params,
                    json=json_data,
                    timeout=30.0,
                )
                
                if response.status_code == 401:
                    # Try token refresh and retry once
                    await self._refresh_token()
                    response = await client.request(
                        method=method,
                        url=url,
                        headers={
                            "Authorization": f"Bearer {self.access_token}",
                            "Content-Type": "application/json",
                        },
                        params=params,
                        json=json_data,
                        timeout=30.0,
                    )
                    
                if response.status_code >= 400:
                    raise MauticAPIError(
                        f"Mautic API error: {response.status_code}",
                        status_code=response.status_code,
                        response_body=response.text,
                    )
                    
                return response.json()
                
            except httpx.RequestError as e:
                logger.error(f"Mautic request error: {e}")
                raise MauticAPIError(f"Request failed: {str(e)}")
    
    # =========================================================================
    # Contact Operations (Read)
    # =========================================================================
    
    async def get_contacts(
        self,
        limit: int = 30,
        start: int = 0,
        search: Optional[str] = None,
        order_by: str = "date_added",
        order_direction: str = "DESC",
    ) -> dict:
        """
        Get a list of contacts.
        
        Args:
            limit: Maximum number of contacts to return (max 100)
            start: Starting offset for pagination
            search: Search query string
            order_by: Field to order by
            order_direction: ASC or DESC
            
        Returns:
            Dictionary with contacts and total count
        """
        params = {
            "limit": min(limit, 100),
            "start": start,
            "orderBy": order_by,
            "orderByDir": order_direction,
        }
        if search:
            params["search"] = search
            
        return await self._request("GET", "/api/contacts", params=params)
    
    async def get_contact(self, contact_id: int) -> dict:
        """
        Get a single contact by ID.
        
        Args:
            contact_id: Mautic contact ID
            
        Returns:
            Contact data
        """
        return await self._request("GET", f"/api/contacts/{contact_id}")
    
    async def search_contacts(
        self,
        query: str,
        limit: int = 30,
    ) -> dict:
        """
        Search contacts using Mautic's search syntax.
        
        Args:
            query: Search query (e.g., "email:*@company.com" or "tag:hot-lead")
            limit: Maximum results
            
        Returns:
            Matching contacts
        """
        return await self.get_contacts(limit=limit, search=query)
    
    async def get_contact_activity(self, contact_id: int, limit: int = 25) -> dict:
        """
        Get activity timeline for a contact.
        
        Args:
            contact_id: Mautic contact ID
            limit: Maximum events to return
            
        Returns:
            Activity events
        """
        return await self._request(
            "GET",
            f"/api/contacts/{contact_id}/activity",
            params={"limit": limit}
        )
    
    async def get_contact_notes(self, contact_id: int) -> dict:
        """Get notes for a contact."""
        return await self._request("GET", f"/api/contacts/{contact_id}/notes")
    
    # =========================================================================
    # Email Operations (Read)
    # =========================================================================
    
    async def get_emails(
        self,
        limit: int = 30,
        start: int = 0,
        search: Optional[str] = None,
    ) -> dict:
        """
        Get a list of emails.
        
        Args:
            limit: Maximum emails to return
            start: Starting offset
            search: Search query
            
        Returns:
            Dictionary with emails and total
        """
        params = {"limit": min(limit, 100), "start": start}
        if search:
            params["search"] = search
        return await self._request("GET", "/api/emails", params=params)
    
    async def get_email(self, email_id: int) -> dict:
        """Get a single email by ID."""
        return await self._request("GET", f"/api/emails/{email_id}")
    
    # =========================================================================
    # Campaign Operations (Read)
    # =========================================================================
    
    async def get_campaigns(
        self,
        limit: int = 30,
        start: int = 0,
        search: Optional[str] = None,
    ) -> dict:
        """Get a list of campaigns (workflows)."""
        params = {"limit": min(limit, 100), "start": start}
        if search:
            params["search"] = search
        return await self._request("GET", "/api/campaigns", params=params)
    
    async def get_campaign(self, campaign_id: int) -> dict:
        """Get a single campaign by ID."""
        return await self._request("GET", f"/api/campaigns/{campaign_id}")
    
    # =========================================================================
    # Segment Operations (Read)
    # =========================================================================
    
    async def get_segments(
        self,
        limit: int = 30,
        start: int = 0,
    ) -> dict:
        """Get a list of segments."""
        return await self._request(
            "GET",
            "/api/segments",
            params={"limit": min(limit, 100), "start": start}
        )
    
    async def get_segment(self, segment_id: int) -> dict:
        """Get a single segment by ID."""
        return await self._request("GET", f"/api/segments/{segment_id}")
    
    # =========================================================================
    # Form Operations (Read)
    # =========================================================================
    
    async def get_forms(self, limit: int = 30, start: int = 0) -> dict:
        """Get a list of forms."""
        return await self._request(
            "GET",
            "/api/forms",
            params={"limit": min(limit, 100), "start": start}
        )
    
    # =========================================================================
    # Landing Page Operations (Read)
    # =========================================================================
    
    async def get_pages(self, limit: int = 30, start: int = 0) -> dict:
        """Get a list of landing pages."""
        return await self._request(
            "GET",
            "/api/pages",
            params={"limit": min(limit, 100), "start": start}
        )
    
    # =========================================================================
    # Statistics/Analytics (Read)
    # =========================================================================
    
    async def get_email_stats(self, email_id: int) -> dict:
        """Get statistics for a specific email."""
        email_data = await self.get_email(email_id)
        return email_data.get("email", {}).get("stats", {})
    
    async def get_campaign_contacts(
        self,
        campaign_id: int,
        limit: int = 30,
    ) -> dict:
        """Get contacts in a campaign."""
        return await self._request(
            "GET",
            f"/api/campaigns/{campaign_id}/contacts",
            params={"limit": min(limit, 100)}
        )
    
    # =========================================================================
    # Summary Methods (for quick overviews)
    # =========================================================================
    
    async def get_summary_stats(self) -> dict:
        """
        Get a quick summary of the Mautic instance.
        
        Returns:
            Dictionary with counts of contacts, emails, campaigns, etc.
        """
        results = {}
        
        try:
            contacts = await self.get_contacts(limit=1)
            results["total_contacts"] = contacts.get("total", 0)
        except Exception as e:
            logger.warning(f"Failed to get contact count: {e}")
            results["total_contacts"] = 0
            
        try:
            emails = await self.get_emails(limit=1)
            results["total_emails"] = emails.get("total", 0)
        except Exception as e:
            logger.warning(f"Failed to get email count: {e}")
            results["total_emails"] = 0
            
        try:
            campaigns = await self.get_campaigns(limit=1)
            results["total_campaigns"] = campaigns.get("total", 0)
        except Exception as e:
            logger.warning(f"Failed to get campaign count: {e}")
            results["total_campaigns"] = 0
            
        try:
            segments = await self.get_segments(limit=1)
            results["total_segments"] = segments.get("total", 0)
        except Exception as e:
            logger.warning(f"Failed to get segment count: {e}")
            results["total_segments"] = 0
            
        return results
    
    # =========================================================================
    # Contact Operations (Write) - Phase B
    # =========================================================================
    
    async def create_contact(self, data: dict) -> dict:
        """
        Create a new contact.
        
        Args:
            data: Contact data (firstname, lastname, email, etc.)
            
        Returns:
            Created contact data
        """
        return await self._request("POST", "/api/contacts/new", json_data=data)
    
    async def update_contact(self, contact_id: int, data: dict) -> dict:
        """
        Update an existing contact.
        
        Args:
            contact_id: Mautic contact ID
            data: Fields to update
            
        Returns:
            Updated contact data
        """
        return await self._request("PATCH", f"/api/contacts/{contact_id}/edit", json_data=data)
    
    async def add_contact_tag(self, contact_id: int, tag: str) -> dict:
        """Add a tag to a contact."""
        return await self._request(
            "POST",
            f"/api/contacts/{contact_id}/tags/add",
            json_data={"tags": [tag]}
        )
    
    async def remove_contact_tag(self, contact_id: int, tag: str) -> dict:
        """Remove a tag from a contact."""
        return await self._request(
            "POST",
            f"/api/contacts/{contact_id}/tags/remove",
            json_data={"tags": [tag]}
        )
    
    async def add_contact_note(self, contact_id: int, note: str) -> dict:
        """Add a note to a contact."""
        return await self._request(
            "POST",
            f"/api/contacts/{contact_id}/notes/new",
            json_data={"note": note}
        )
    
    async def add_contact_to_segment(self, segment_id: int, contact_id: int) -> dict:
        """Add a contact to a segment."""
        return await self._request(
            "POST",
            f"/api/segments/{segment_id}/contact/{contact_id}/add"
        )
    
    async def remove_contact_from_segment(self, segment_id: int, contact_id: int) -> dict:
        """Remove a contact from a segment."""
        return await self._request(
            "POST",
            f"/api/segments/{segment_id}/contact/{contact_id}/remove"
        )
    
    async def add_contact_to_campaign(self, campaign_id: int, contact_id: int) -> dict:
        """Add a contact to a campaign."""
        return await self._request(
            "POST",
            f"/api/campaigns/{campaign_id}/contact/{contact_id}/add"
        )
    
    # =========================================================================
    # Email Operations (Write) - Phase B
    # =========================================================================
    
    async def create_email(
        self,
        name: str,
        subject: str,
        body: str,
        email_type: str = "template",
        from_name: Optional[str] = None,
        from_address: Optional[str] = None,
    ) -> dict:
        """
        Create a new email.
        
        Args:
            name: Internal name for the email
            subject: Email subject line
            body: HTML body content
            email_type: "template" or "list"
            from_name: Sender name (optional)
            from_address: Sender email (optional)
            
        Returns:
            Created email data
        """
        data = {
            "name": name,
            "subject": subject,
            "customHtml": body,
            "emailType": email_type,
            "isPublished": False,  # Don't auto-publish
        }
        if from_name:
            data["fromName"] = from_name
        if from_address:
            data["fromAddress"] = from_address
            
        return await self._request("POST", "/api/emails/new", json_data=data)
    
    async def send_email_to_contact(self, email_id: int, contact_id: int) -> dict:
        """Send an email to a specific contact."""
        return await self._request(
            "POST",
            f"/api/emails/{email_id}/contact/{contact_id}/send"
        )
    
    async def send_email_to_segment(self, email_id: int, segment_id: int) -> dict:
        """Send an email to all contacts in a segment."""
        return await self._request(
            "POST",
            f"/api/emails/{email_id}/send",
            json_data={"lists": [segment_id]}
        )
    
    # =========================================================================
    # Campaign Operations (Write) - Phase B
    # =========================================================================
    
    async def create_campaign(
        self,
        name: str,
        description: Optional[str] = None,
    ) -> dict:
        """
        Create a new campaign (workflow).
        
        Args:
            name: Campaign name
            description: Optional description
            
        Returns:
            Created campaign data
        """
        data = {
            "name": name,
            "isPublished": False,
        }
        if description:
            data["description"] = description
            
        return await self._request("POST", "/api/campaigns/new", json_data=data)
    
    async def publish_campaign(self, campaign_id: int) -> dict:
        """Publish a campaign (make it active)."""
        return await self._request(
            "PATCH",
            f"/api/campaigns/{campaign_id}/edit",
            json_data={"isPublished": True}
        )
    
    async def unpublish_campaign(self, campaign_id: int) -> dict:
        """Unpublish a campaign (make it inactive)."""
        return await self._request(
            "PATCH",
            f"/api/campaigns/{campaign_id}/edit",
            json_data={"isPublished": False}
        )
    
    # =========================================================================
    # Segment Operations (Write) - Phase B
    # =========================================================================
    
    async def create_segment(
        self,
        name: str,
        description: Optional[str] = None,
        filters: Optional[list] = None,
    ) -> dict:
        """
        Create a new segment.
        
        Args:
            name: Segment name
            description: Optional description
            filters: Optional filter rules
            
        Returns:
            Created segment data
        """
        data = {
            "name": name,
            "isPublished": True,
        }
        if description:
            data["description"] = description
        if filters:
            data["filters"] = filters
            
        return await self._request("POST", "/api/segments/new", json_data=data)
    
    async def rebuild_segment(self, segment_id: int) -> dict:
        """Trigger a rebuild of segment membership."""
        return await self._request(
            "POST",
            f"/api/segments/{segment_id}/rebuild"
        )
