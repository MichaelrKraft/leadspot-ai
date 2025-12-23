"""
Salesforce Sync Service

Syncs CRM data from Salesforce to InnoSynth.ai.
Fetches Accounts, Contacts, Opportunities, and other objects,
then indexes them for knowledge synthesis.
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Document
from app.models.oauth_connection import OAuthConnection
from app.services import local_embedding_service, local_vector_store
from app.services.encryption import get_encryption_service

logger = logging.getLogger(__name__)


class SalesforceSyncService:
    """Syncs CRM data from Salesforce."""

    # Salesforce objects to sync and their important fields
    SYNC_OBJECTS = {
        'Account': {
            'fields': ['Id', 'Name', 'Type', 'Industry', 'Description', 'Website',
                      'Phone', 'BillingCity', 'BillingState', 'BillingCountry',
                      'AnnualRevenue', 'NumberOfEmployees', 'CreatedDate', 'LastModifiedDate'],
            'query_filter': "WHERE IsDeleted = false",
        },
        'Contact': {
            'fields': ['Id', 'FirstName', 'LastName', 'Email', 'Phone', 'Title',
                      'Department', 'AccountId', 'Description', 'CreatedDate', 'LastModifiedDate'],
            'query_filter': "WHERE IsDeleted = false",
        },
        'Opportunity': {
            'fields': ['Id', 'Name', 'StageName', 'Amount', 'Probability', 'CloseDate',
                      'Type', 'AccountId', 'Description', 'CreatedDate', 'LastModifiedDate'],
            'query_filter': "WHERE IsDeleted = false",
        },
        'Lead': {
            'fields': ['Id', 'FirstName', 'LastName', 'Email', 'Phone', 'Company',
                      'Title', 'Industry', 'Status', 'Description', 'CreatedDate', 'LastModifiedDate'],
            'query_filter': "WHERE IsDeleted = false AND IsConverted = false",
        },
        'Case': {
            'fields': ['Id', 'CaseNumber', 'Subject', 'Description', 'Status', 'Priority',
                      'Origin', 'AccountId', 'ContactId', 'CreatedDate', 'LastModifiedDate'],
            'query_filter': "WHERE IsDeleted = false",
        },
    }

    # API version
    API_VERSION = "v59.0"

    def __init__(self):
        self.encryption_service = get_encryption_service()

    async def sync_connection(
        self,
        connection: OAuthConnection,
        db: AsyncSession,
        max_records: int = 100,
    ) -> dict[str, Any]:
        """
        Sync CRM data from a Salesforce connection.

        Args:
            connection: The OAuth connection to sync
            db: Database session
            max_records: Maximum number of records per object type

        Returns:
            Sync results dictionary
        """
        logger.info(f"Starting Salesforce sync for connection {connection.connection_id}")

        results = {
            "connection_id": connection.connection_id,
            "started_at": datetime.utcnow().isoformat(),
            "objects_synced": {},
            "total_records": 0,
            "records_synced": 0,
            "records_skipped": 0,
            "errors": [],
        }

        try:
            # Decrypt access token
            access_token = self.encryption_service.decrypt(connection.access_token)

            # Get the instance URL (stored in provider_user_id or use default)
            # In a real implementation, we'd store this during OAuth callback
            instance_url = getattr(connection, 'metadata', {}).get(
                'instance_url', 'https://login.salesforce.com'
            )

            # If we don't have instance_url stored, try to get it from user info
            if instance_url == 'https://login.salesforce.com':
                user_info = await self._get_user_info(access_token)
                # Extract instance URL from user ID URL
                if user_info and user_info.get('urls', {}).get('rest'):
                    instance_url = user_info['urls']['rest'].replace('/services/data/{version}/', '')
                    instance_url = instance_url.rstrip('/')

            # Sync each object type
            for object_type, config in self.SYNC_OBJECTS.items():
                try:
                    object_results = await self._sync_object(
                        object_type=object_type,
                        config=config,
                        access_token=access_token,
                        instance_url=instance_url,
                        connection=connection,
                        db=db,
                        max_records=max_records,
                    )
                    results["objects_synced"][object_type] = object_results
                    results["total_records"] += object_results.get("found", 0)
                    results["records_synced"] += object_results.get("synced", 0)
                    results["records_skipped"] += object_results.get("skipped", 0)
                except Exception as e:
                    logger.error(f"Error syncing {object_type}: {e}")
                    results["errors"].append({
                        "object": object_type,
                        "error": str(e),
                    })

            # Update connection sync status
            connection.last_sync_at = datetime.utcnow()
            connection.last_sync_status = "success" if not results["errors"] else "partial"
            connection.documents_synced = results["records_synced"]
            await db.commit()

            results["completed_at"] = datetime.utcnow().isoformat()
            logger.info(
                f"Salesforce sync completed: {results['records_synced']} synced, "
                f"{results['records_skipped']} skipped"
            )

        except Exception as e:
            logger.error(f"Salesforce sync failed: {e}")
            connection.last_sync_status = "error"
            await db.commit()
            results["error"] = str(e)

        return results

    async def _get_user_info(self, access_token: str) -> dict | None:
        """Get user info to retrieve instance URL."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://login.salesforce.com/services/oauth2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if response.status_code == 200:
                return response.json()
        return None

    async def _sync_object(
        self,
        object_type: str,
        config: dict[str, Any],
        access_token: str,
        instance_url: str,
        connection: OAuthConnection,
        db: AsyncSession,
        max_records: int,
    ) -> dict[str, int]:
        """Sync a single Salesforce object type."""
        results = {"found": 0, "synced": 0, "skipped": 0}

        # Build SOQL query
        fields = ", ".join(config["fields"])
        query = f"SELECT {fields} FROM {object_type} {config['query_filter']} LIMIT {max_records}"

        # Execute query
        records = await self._query_salesforce(access_token, instance_url, query)
        results["found"] = len(records)

        # Process each record
        for record in records:
            try:
                synced = await self._sync_record(
                    object_type=object_type,
                    record=record,
                    connection=connection,
                    db=db,
                )
                if synced:
                    results["synced"] += 1
                else:
                    results["skipped"] += 1
            except Exception as e:
                logger.error(f"Error syncing {object_type} record {record.get('Id')}: {e}")
                results["skipped"] += 1

        return results

    async def _query_salesforce(
        self,
        access_token: str,
        instance_url: str,
        query: str,
    ) -> list[dict[str, Any]]:
        """Execute a SOQL query against Salesforce."""
        records = []

        async with httpx.AsyncClient() as client:
            url = f"{instance_url}/services/data/{self.API_VERSION}/query"
            params = {"q": query}

            response = await client.get(
                url,
                headers={"Authorization": f"Bearer {access_token}"},
                params=params,
            )
            response.raise_for_status()
            data = response.json()

            records.extend(data.get("records", []))

            # Handle pagination if there are more records
            while data.get("nextRecordsUrl"):
                next_url = f"{instance_url}{data['nextRecordsUrl']}"
                response = await client.get(
                    next_url,
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                response.raise_for_status()
                data = response.json()
                records.extend(data.get("records", []))

        return records

    async def _sync_record(
        self,
        object_type: str,
        record: dict[str, Any],
        connection: OAuthConnection,
        db: AsyncSession,
    ) -> bool:
        """
        Sync a single Salesforce record.

        Returns True if record was synced, False if skipped.
        """
        record_id = record.get("Id")
        source_id = f"{object_type}_{record_id}"

        # Check if already synced
        existing = await db.execute(
            select(Document).where(
                Document.organization_id == connection.organization_id,
                Document.source_system == "salesforce",
                Document.source_id == source_id,
            )
        )
        existing_doc = existing.scalar_one_or_none()

        # Check modification time
        last_modified_str = record.get("LastModifiedDate")
        if last_modified_str:
            remote_modified = datetime.fromisoformat(
                last_modified_str.replace("Z", "+00:00")
            )
        else:
            remote_modified = datetime.utcnow()

        if existing_doc:
            # Skip if not modified since last sync
            if existing_doc.last_modified and existing_doc.last_modified >= remote_modified:
                logger.debug(f"Skipping unchanged {object_type}: {record_id}")
                return False

        # Convert record to searchable content
        content = self._record_to_content(object_type, record)
        title = self._get_record_title(object_type, record)

        # Create or update document
        if existing_doc:
            existing_doc.content = self.encryption_service.encrypt(content)
            existing_doc.title = title
            existing_doc.last_modified = remote_modified
        else:
            doc = Document(
                document_id=str(uuid.uuid4()),
                organization_id=connection.organization_id,
                user_id=connection.user_id,
                title=title,
                filename=f"{object_type}_{record_id}.json",
                content=self.encryption_service.encrypt(content),
                mime_type="application/json",
                source_system="salesforce",
                source_id=source_id,
                source_url=None,  # Could add Salesforce record URL here
                file_size=len(content),
                status="uploaded",
                created_at=datetime.utcnow(),
                last_modified=remote_modified,
            )
            db.add(doc)

        await db.commit()

        # Index for search
        try:
            doc_to_index = existing_doc if existing_doc else doc
            await self._index_document(doc_to_index, content, object_type, record)
        except Exception as e:
            logger.error(f"Failed to index {object_type} {record_id}: {e}")

        return True

    def _record_to_content(self, object_type: str, record: dict[str, Any]) -> str:
        """Convert a Salesforce record to searchable text content."""
        # Remove Salesforce metadata fields
        clean_record = {k: v for k, v in record.items() if not k.startswith('attributes')}

        # Create a natural language description
        if object_type == "Account":
            lines = [
                f"Account: {record.get('Name', 'Unknown')}",
                f"Type: {record.get('Type', 'N/A')}",
                f"Industry: {record.get('Industry', 'N/A')}",
                f"Website: {record.get('Website', 'N/A')}",
                f"Phone: {record.get('Phone', 'N/A')}",
                f"Location: {record.get('BillingCity', '')}, {record.get('BillingState', '')} {record.get('BillingCountry', '')}".strip(', '),
                f"Annual Revenue: ${record.get('AnnualRevenue', 'N/A'):,.0f}" if record.get('AnnualRevenue') else "Annual Revenue: N/A",
                f"Employees: {record.get('NumberOfEmployees', 'N/A')}",
                f"Description: {record.get('Description', 'No description')}",
            ]
        elif object_type == "Contact":
            lines = [
                f"Contact: {record.get('FirstName', '')} {record.get('LastName', '')}".strip(),
                f"Title: {record.get('Title', 'N/A')}",
                f"Department: {record.get('Department', 'N/A')}",
                f"Email: {record.get('Email', 'N/A')}",
                f"Phone: {record.get('Phone', 'N/A')}",
                f"Account ID: {record.get('AccountId', 'N/A')}",
                f"Description: {record.get('Description', 'No description')}",
            ]
        elif object_type == "Opportunity":
            lines = [
                f"Opportunity: {record.get('Name', 'Unknown')}",
                f"Stage: {record.get('StageName', 'N/A')}",
                f"Amount: ${record.get('Amount', 0):,.0f}" if record.get('Amount') else "Amount: N/A",
                f"Probability: {record.get('Probability', 0)}%",
                f"Close Date: {record.get('CloseDate', 'N/A')}",
                f"Type: {record.get('Type', 'N/A')}",
                f"Account ID: {record.get('AccountId', 'N/A')}",
                f"Description: {record.get('Description', 'No description')}",
            ]
        elif object_type == "Lead":
            lines = [
                f"Lead: {record.get('FirstName', '')} {record.get('LastName', '')}".strip(),
                f"Company: {record.get('Company', 'N/A')}",
                f"Title: {record.get('Title', 'N/A')}",
                f"Industry: {record.get('Industry', 'N/A')}",
                f"Status: {record.get('Status', 'N/A')}",
                f"Email: {record.get('Email', 'N/A')}",
                f"Phone: {record.get('Phone', 'N/A')}",
                f"Description: {record.get('Description', 'No description')}",
            ]
        elif object_type == "Case":
            lines = [
                f"Case #{record.get('CaseNumber', 'Unknown')}: {record.get('Subject', 'No Subject')}",
                f"Status: {record.get('Status', 'N/A')}",
                f"Priority: {record.get('Priority', 'N/A')}",
                f"Origin: {record.get('Origin', 'N/A')}",
                f"Account ID: {record.get('AccountId', 'N/A')}",
                f"Contact ID: {record.get('ContactId', 'N/A')}",
                f"Description: {record.get('Description', 'No description')}",
            ]
        else:
            # Generic format
            lines = [f"{k}: {v}" for k, v in clean_record.items() if v]

        content = "\n".join(lines)

        # Also include the raw JSON for precise queries
        content += f"\n\n--- Raw Data ---\n{json.dumps(clean_record, indent=2, default=str)}"

        return content

    def _get_record_title(self, object_type: str, record: dict[str, Any]) -> str:
        """Get a human-readable title for a record."""
        if object_type == "Account":
            return f"Account: {record.get('Name', 'Unknown')}"
        elif object_type == "Contact":
            return f"Contact: {record.get('FirstName', '')} {record.get('LastName', '')}".strip()
        elif object_type == "Opportunity":
            return f"Opportunity: {record.get('Name', 'Unknown')}"
        elif object_type == "Lead":
            return f"Lead: {record.get('FirstName', '')} {record.get('LastName', '')}".strip()
        elif object_type == "Case":
            return f"Case: {record.get('CaseNumber', record.get('Id', 'Unknown'))}"
        else:
            return f"{object_type}: {record.get('Id', 'Unknown')}"

    async def _index_document(
        self,
        doc: Document,
        content: str,
        object_type: str,
        record: dict[str, Any],
    ):
        """Index document content for semantic search."""
        if not local_embedding_service.is_available():
            logger.warning("Embedding service not available, skipping indexing")
            return

        # Add to vector store
        local_vector_store.add_document(
            document_id=str(doc.document_id),
            organization_id=doc.organization_id,
            content=content,
            metadata={
                "title": doc.title,
                "filename": doc.filename,
                "source_system": doc.source_system,
                "source_id": doc.source_id,
                "salesforce_object": object_type,
                "salesforce_id": record.get("Id"),
            }
        )

        # Update document status
        doc.status = "indexed"
