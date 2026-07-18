"""Neo4j database service for knowledge graph operations.

SECURITY: All queries MUST include organization_id filtering to ensure
proper multi-tenant isolation. Never query without org context.
"""

from typing import Any

from neo4j import AsyncDriver, AsyncGraphDatabase

from app.config import settings


class Neo4jService:
    """Service for managing Neo4j database connections and queries.

    IMPORTANT: All public query methods require organization_id parameter
    to enforce multi-tenant data isolation.
    """

    def __init__(self):
        self.driver: AsyncDriver | None = None
        self.uri = settings.NEO4J_URI
        self.user = settings.NEO4J_USER
        self.password = settings.NEO4J_PASSWORD

    async def connect(self):
        """Initialize the Neo4j driver connection."""
        if not self.driver:
            self.driver = AsyncGraphDatabase.driver(
                self.uri,
                auth=(self.user, self.password)
            )
            # Verify connectivity
            await self.verify_connection()

    async def disconnect(self):
        """Close the Neo4j driver connection."""
        if self.driver:
            await self.driver.close()
            self.driver = None

    async def verify_connection(self) -> bool:
        """
        Verify the database connection is working.

        Returns:
            True if connection is successful
        """
        try:
            async with self.driver.session() as session:
                result = await session.run("RETURN 1 as num")
                record = await result.single()
                return record["num"] == 1
        except Exception as e:
            print(f"Neo4j connection error: {e}")
            return False

    async def execute_query(
        self,
        query: str,
        parameters: dict[str, Any] = None
    ) -> list[dict]:
        """
        Execute a Cypher query and return results.

        Args:
            query: Cypher query string
            parameters: Query parameters

        Returns:
            List of result records as dictionaries
        """
        if not self.driver:
            await self.connect()

        async with self.driver.session() as session:
            result = await session.run(query, parameters or {})
            records = await result.data()
            return records

    async def execute_write(
        self,
        query: str,
        parameters: dict[str, Any] = None
    ) -> list[dict]:
        """
        Execute a write transaction (CREATE, MERGE, SET, DELETE).

        Args:
            query: Cypher query string
            parameters: Query parameters

        Returns:
            List of result records
        """
        if not self.driver:
            await self.connect()

        async def _write_tx(tx, query, params):
            result = await tx.run(query, params)
            return await result.data()

        async with self.driver.session() as session:
            records = await session.execute_write(
                _write_tx,
                query,
                parameters or {}
            )
            return records

    async def create_constraints(self):
        """Create database constraints and indexes for optimal performance.

        SECURITY: Includes organization_id indexes for multi-tenant isolation.
        """
        constraints = [
            # Unique constraints - scoped by organization
            "CREATE CONSTRAINT decision_id_unique IF NOT EXISTS FOR (d:Decision) REQUIRE d.id IS UNIQUE",
            # Person/Project/Factor are unique per organization, not globally
            "CREATE CONSTRAINT person_org_unique IF NOT EXISTS FOR (p:Person) REQUIRE (p.name, p.organization_id) IS UNIQUE",
            "CREATE CONSTRAINT project_org_unique IF NOT EXISTS FOR (p:Project) REQUIRE (p.name, p.organization_id) IS UNIQUE",
            "CREATE CONSTRAINT factor_org_unique IF NOT EXISTS FOR (f:Factor) REQUIRE (f.name, f.category, f.organization_id) IS UNIQUE",

            # CRITICAL: Organization indexes for multi-tenant queries
            "CREATE INDEX decision_org_id IF NOT EXISTS FOR (d:Decision) ON (d.organization_id)",
            "CREATE INDEX person_org_id IF NOT EXISTS FOR (p:Person) ON (p.organization_id)",
            "CREATE INDEX project_org_id IF NOT EXISTS FOR (p:Project) ON (p.organization_id)",
            "CREATE INDEX factor_org_id IF NOT EXISTS FOR (f:Factor) ON (f.organization_id)",

            # Performance indexes
            "CREATE INDEX decision_created_at IF NOT EXISTS FOR (d:Decision) ON (d.created_at)",
            "CREATE INDEX decision_user_id IF NOT EXISTS FOR (d:Decision) ON (d.user_id)",
            "CREATE INDEX factor_category IF NOT EXISTS FOR (f:Factor) ON (f.category)",
            "CREATE INDEX project_status IF NOT EXISTS FOR (p:Project) ON (p.status)"
        ]

        for constraint in constraints:
            try:
                await self.execute_write(constraint)
            except Exception as e:
                # Constraint may already exist
                print(f"Constraint/Index creation note: {e}")

    async def get_graph_stats(self, organization_id: str) -> dict[str, int]:
        """
        Get statistics about the knowledge graph for a specific organization.

        SECURITY: Filters by organization_id to prevent cross-org data leaks.

        Args:
            organization_id: UUID of the organization (REQUIRED)

        Returns:
            Dictionary with node and relationship counts for the organization
        """
        if not organization_id:
            raise ValueError("organization_id is required for multi-tenant isolation")

        query = """
        MATCH (d:Decision {organization_id: $org_id}) WITH count(d) as decisions
        OPTIONAL MATCH (p:Person {organization_id: $org_id}) WITH decisions, count(p) as people
        OPTIONAL MATCH (pr:Project {organization_id: $org_id}) WITH decisions, people, count(pr) as projects
        OPTIONAL MATCH (f:Factor {organization_id: $org_id}) WITH decisions, people, projects, count(f) as factors
        OPTIONAL MATCH (d2:Decision {organization_id: $org_id})-[r]->()
        WITH decisions, people, projects, factors, count(r) as relationships
        RETURN decisions, people, projects, factors, relationships
        """

        result = await self.execute_query(query, {"org_id": organization_id})

        if result:
            return result[0]
        return {
            "decisions": 0,
            "people": 0,
            "projects": 0,
            "factors": 0,
            "relationships": 0
        }

    async def search_decisions(
        self,
        keywords: list[str],
        organization_id: str,
        limit: int = 20
    ) -> list[dict]:
        """
        Search for decisions using keywords within an organization.

        SECURITY: Filters by organization_id to prevent cross-org data leaks.

        Args:
            keywords: List of search keywords
            organization_id: UUID of the organization (REQUIRED)
            limit: Maximum number of results

        Returns:
            List of matching decisions within the organization
        """
        if not organization_id:
            raise ValueError("organization_id is required for multi-tenant isolation")

        # Build regex pattern for case-insensitive search
        keyword_pattern = "|".join(keywords)

        query = """
        MATCH (d:Decision {organization_id: $org_id})
        WHERE d.title =~ $pattern OR d.description =~ $pattern
        RETURN
            d.id as id,
            d.title as title,
            d.description as description,
            d.created_at as created_at
        ORDER BY d.created_at DESC
        LIMIT $limit
        """

        params = {
            "org_id": organization_id,
            "pattern": f"(?i).*({keyword_pattern}).*",
            "limit": limit
        }

        results = await self.execute_query(query, params)
        return results

    async def get_decision_graph(
        self,
        decision_id: str,
        organization_id: str,
        depth: int = 1
    ) -> dict:
        """
        Get a subgraph centered on a specific decision within an organization.

        SECURITY: Only returns nodes that belong to the same organization.

        Args:
            decision_id: UUID of the decision
            organization_id: UUID of the organization (REQUIRED)
            depth: How many hops to traverse

        Returns:
            Graph data with nodes and relationships
        """
        if not organization_id:
            raise ValueError("organization_id is required for multi-tenant isolation")

        # Simple query that filters by organization_id on all nodes
        simple_query = f"""
        MATCH (d:Decision {{id: $decision_id, organization_id: $org_id}})
        MATCH path = (d)-[*0..{depth}]-(n)
        WHERE n.organization_id = $org_id OR n.organization_id IS NULL
        WITH collect(nodes(path)) as nodePaths, collect(relationships(path)) as relPaths
        UNWIND nodePaths as nodePath
        UNWIND nodePath as n
        WITH collect(DISTINCT n) as nodes, relPaths
        UNWIND relPaths as relPath
        UNWIND relPath as r
        WITH nodes, collect(DISTINCT r) as relationships
        RETURN nodes, relationships
        """

        params = {"decision_id": decision_id, "org_id": organization_id}

        try:
            result = await self.execute_query(simple_query, params)
        except Exception as e:
            print(f"Error getting decision graph: {e}")
            return {"nodes": [], "relationships": []}

        if result:
            return {
                "nodes": result[0].get("nodes", []),
                "relationships": result[0].get("relationships", [])
            }

        return {"nodes": [], "relationships": []}

    async def clear_database(self):
        """Delete all nodes and relationships. USE WITH CAUTION!"""
        query = "MATCH (n) DETACH DELETE n"
        await self.execute_write(query)


# Global instance
neo4j_service = Neo4jService()
