"""
Neo4j Graph Service

Manages knowledge graph operations:
- Document nodes and relationships
- Author relationships
- Citation tracking
- Decision context links
- Graph queries for insights
"""

import logging
from datetime import datetime
from typing import Any

from neo4j import AsyncDriver, AsyncGraphDatabase
from neo4j.exceptions import Neo4jError

logger = logging.getLogger(__name__)


class GraphService:
    """Service for managing Neo4j knowledge graph."""

    def __init__(
        self,
        uri: str,
        username: str,
        password: str,
        database: str = "neo4j"
    ):
        """
        Initialize graph service.

        Args:
            uri: Neo4j connection URI
            username: Database username
            password: Database password
            database: Database name
        """
        self.driver: AsyncDriver = AsyncGraphDatabase.driver(
            uri,
            auth=(username, password)
        )
        self.database = database

    async def close(self):
        """Close database connection."""
        await self.driver.close()

    async def create_document_node(
        self,
        document_id: str,
        metadata: dict[str, Any],
        organization_id: str
    ) -> dict[str, Any]:
        """
        Create a document node in the graph.

        Args:
            document_id: Unique document identifier
            metadata: Document metadata
            organization_id: Organization owning the document

        Returns:
            Created node properties
        """
        query = """
        MERGE (d:Document {id: $document_id})
        SET d.title = $title,
            d.document_type = $document_type,
            d.created_at = $created_at,
            d.language = $language,
            d.word_count = $word_count,
            d.token_count = $token_count,
            d.summary = $summary,
            d.updated_at = datetime()
        WITH d
        MATCH (org:Organization {id: $organization_id})
        MERGE (org)-[:OWNS]->(d)
        RETURN d
        """

        params = {
            'document_id': document_id,
            'organization_id': organization_id,
            'title': metadata.get('title', 'Untitled'),
            'document_type': metadata.get('document_type', 'unknown'),
            'created_at': metadata.get('created_at', datetime.utcnow().isoformat()),
            'language': metadata.get('language', 'en'),
            'word_count': metadata.get('word_count', 0),
            'token_count': metadata.get('token_count', 0),
            'summary': metadata.get('ai_summary', '')[:500],  # Limit summary length
        }

        try:
            async with self.driver.session(database=self.database) as session:
                result = await session.run(query, params)
                record = await result.single()
                return dict(record['d']) if record else {}

        except Neo4jError as e:
            logger.error(f"Error creating document node: {e!s}", exc_info=True)
            raise

    async def create_author_relationship(
        self,
        document_id: str,
        author_name: str,
        author_metadata: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """
        Create or link author to document.

        Args:
            document_id: Document identifier
            author_name: Author's name
            author_metadata: Additional author information

        Returns:
            Relationship information
        """
        query = """
        MATCH (d:Document {id: $document_id})
        MERGE (a:Author {name: $author_name})
        ON CREATE SET a.created_at = datetime()
        MERGE (a)-[r:AUTHORED]->(d)
        ON CREATE SET r.created_at = datetime()
        RETURN a, r
        """

        params = {
            'document_id': document_id,
            'author_name': author_name
        }

        try:
            async with self.driver.session(database=self.database) as session:
                result = await session.run(query, params)
                record = await result.single()
                return {
                    'author': dict(record['a']) if record else {},
                    'relationship': dict(record['r']) if record else {}
                }

        except Neo4jError as e:
            logger.error(f"Error creating author relationship: {e!s}", exc_info=True)
            raise

    async def create_citation(
        self,
        source_doc_id: str,
        cited_doc_id: str,
        context: str | None = None
    ) -> dict[str, Any]:
        """
        Create a citation relationship between documents.

        Args:
            source_doc_id: Document that cites
            cited_doc_id: Document being cited
            context: Context of the citation

        Returns:
            Citation relationship
        """
        query = """
        MATCH (source:Document {id: $source_doc_id})
        MATCH (cited:Document {id: $cited_doc_id})
        MERGE (source)-[r:CITES]->(cited)
        ON CREATE SET r.created_at = datetime(),
                      r.context = $context
        RETURN r
        """

        params = {
            'source_doc_id': source_doc_id,
            'cited_doc_id': cited_doc_id,
            'context': context
        }

        try:
            async with self.driver.session(database=self.database) as session:
                result = await session.run(query, params)
                record = await result.single()
                return dict(record['r']) if record else {}

        except Neo4jError as e:
            logger.error(f"Error creating citation: {e!s}", exc_info=True)
            raise

    async def link_to_topic(
        self,
        document_id: str,
        topic: str,
        confidence: float = 1.0
    ) -> dict[str, Any]:
        """
        Link document to a topic.

        Args:
            document_id: Document identifier
            topic: Topic name
            confidence: Confidence score (0-1)

        Returns:
            Topic relationship
        """
        query = """
        MATCH (d:Document {id: $document_id})
        MERGE (t:Topic {name: $topic})
        ON CREATE SET t.created_at = datetime()
        MERGE (d)-[r:RELATES_TO]->(t)
        ON CREATE SET r.confidence = $confidence,
                      r.created_at = datetime()
        RETURN t, r
        """

        params = {
            'document_id': document_id,
            'topic': topic,
            'confidence': confidence
        }

        try:
            async with self.driver.session(database=self.database) as session:
                result = await session.run(query, params)
                record = await result.single()
                return {
                    'topic': dict(record['t']) if record else {},
                    'relationship': dict(record['r']) if record else {}
                }

        except Neo4jError as e:
            logger.error(f"Error linking to topic: {e!s}", exc_info=True)
            raise

    async def get_related_documents(
        self,
        document_id: str,
        limit: int = 10
    ) -> list[dict[str, Any]]:
        """
        Find documents related to a given document.

        Relationships considered:
        - Same author
        - Same topics
        - Citations

        Args:
            document_id: Document identifier
            limit: Maximum number of results

        Returns:
            List of related documents with relationship types
        """
        query = """
        MATCH (d:Document {id: $document_id})
        OPTIONAL MATCH (d)<-[:AUTHORED]-(a:Author)-[:AUTHORED]->(related1:Document)
        WHERE related1.id <> $document_id
        OPTIONAL MATCH (d)-[:RELATES_TO]->(t:Topic)<-[:RELATES_TO]-(related2:Document)
        WHERE related2.id <> $document_id
        OPTIONAL MATCH (d)-[:CITES]->(related3:Document)
        OPTIONAL MATCH (d)<-[:CITES]-(related4:Document)
        WITH collect(DISTINCT related1) + collect(DISTINCT related2) +
             collect(DISTINCT related3) + collect(DISTINCT related4) as related_docs
        UNWIND related_docs as related
        WHERE related IS NOT NULL
        RETURN DISTINCT related
        LIMIT $limit
        """

        params = {
            'document_id': document_id,
            'limit': limit
        }

        try:
            async with self.driver.session(database=self.database) as session:
                result = await session.run(query, params)
                records = await result.values()
                return [dict(record[0]) for record in records if record[0]]

        except Neo4jError as e:
            logger.error(f"Error getting related documents: {e!s}", exc_info=True)
            return []

    async def get_document_graph(
        self,
        document_id: str,
        depth: int = 2
    ) -> dict[str, Any]:
        """
        Get graph neighborhood around a document.

        Args:
            document_id: Document identifier
            depth: How many hops to traverse

        Returns:
            Graph data with nodes and relationships
        """
        query = f"""
        MATCH path = (d:Document {{id: $document_id}})-[*1..{depth}]-(related)
        WITH collect(path) as paths
        CALL apoc.convert.toTree(paths) YIELD value
        RETURN value
        """

        params = {'document_id': document_id}

        try:
            async with self.driver.session(database=self.database) as session:
                result = await session.run(query, params)
                record = await result.single()
                return record['value'] if record else {}

        except Neo4jError as e:
            logger.error(f"Error getting document graph: {e!s}", exc_info=True)
            return {}

    async def delete_document(self, document_id: str) -> bool:
        """
        Delete a document and its relationships.

        Args:
            document_id: Document identifier

        Returns:
            Success boolean
        """
        query = """
        MATCH (d:Document {id: $document_id})
        DETACH DELETE d
        """

        params = {'document_id': document_id}

        try:
            async with self.driver.session(database=self.database) as session:
                await session.run(query, params)
                return True

        except Neo4jError as e:
            logger.error(f"Error deleting document: {e!s}", exc_info=True)
            return False

    async def get_organization_stats(
        self,
        organization_id: str
    ) -> dict[str, Any]:
        """
        Get statistics for an organization's knowledge graph.

        Args:
            organization_id: Organization identifier

        Returns:
            Statistics dictionary
        """
        query = """
        MATCH (org:Organization {id: $organization_id})-[:OWNS]->(d:Document)
        OPTIONAL MATCH (d)<-[:AUTHORED]-(a:Author)
        OPTIONAL MATCH (d)-[:RELATES_TO]->(t:Topic)
        OPTIONAL MATCH (d)-[:CITES]->(cited:Document)
        RETURN
            count(DISTINCT d) as document_count,
            count(DISTINCT a) as author_count,
            count(DISTINCT t) as topic_count,
            count(DISTINCT cited) as citation_count
        """

        params = {'organization_id': organization_id}

        try:
            async with self.driver.session(database=self.database) as session:
                result = await session.run(query, params)
                record = await result.single()
                return dict(record) if record else {}

        except Neo4jError as e:
            logger.error(f"Error getting organization stats: {e!s}", exc_info=True)
            return {}
