"""Populate Neo4j knowledge graph with decision data.

SECURITY: All nodes MUST include organization_id for multi-tenant isolation.
"""

from datetime import datetime

from app.services.neo4j_service import Neo4jService


class GraphPopulator:
    """Create and update nodes and relationships in the knowledge graph.

    IMPORTANT: All node creation methods require organization_id to ensure
    proper multi-tenant data isolation.
    """

    def __init__(self, neo4j_service: Neo4jService):
        self.neo4j = neo4j_service

    async def create_decision_node(
        self,
        decision_id: str,
        title: str,
        description: str,
        created_at: datetime,
        user_id: str,
        organization_id: str,
        metadata: dict = None
    ) -> bool:
        """
        Create a Decision node in the graph.

        SECURITY: Includes organization_id for multi-tenant isolation.

        Args:
            decision_id: UUID of the decision
            title: Decision title
            description: Decision description
            created_at: When the decision was made
            user_id: User who created the decision
            organization_id: UUID of the organization (REQUIRED)
            metadata: Additional properties

        Returns:
            True if successful
        """
        if not organization_id:
            raise ValueError("organization_id is required for multi-tenant isolation")

        query = """
        CREATE (d:Decision {
            id: $decision_id,
            title: $title,
            description: $description,
            created_at: $created_at,
            user_id: $user_id,
            organization_id: $organization_id,
            created_graph_at: datetime()
        })
        SET d += $metadata
        RETURN d.id as id
        """

        params = {
            "decision_id": decision_id,
            "title": title,
            "description": description,
            "created_at": created_at.isoformat(),
            "user_id": user_id,
            "organization_id": organization_id,
            "metadata": metadata or {}
        }

        result = await self.neo4j.execute_query(query, params)
        return len(result) > 0

    async def create_factor_nodes(
        self,
        decision_id: str,
        organization_id: str,
        factors: list[dict]
    ) -> bool:
        """
        Create Factor nodes and link them to a Decision.

        SECURITY: Factors are scoped per organization to prevent cross-org data leaks.

        Args:
            decision_id: UUID of the decision
            organization_id: UUID of the organization (REQUIRED)
            factors: List of factor dictionaries with name, category, impact_score

        Returns:
            True if successful
        """
        if not organization_id:
            raise ValueError("organization_id is required for multi-tenant isolation")

        query = """
        MATCH (d:Decision {id: $decision_id, organization_id: $org_id})
        UNWIND $factors as factor
        MERGE (f:Factor {
            name: factor.name,
            category: factor.category,
            organization_id: $org_id
        })
        ON CREATE SET
            f.created_at = datetime(),
            f.impact_score = factor.impact_score,
            f.explanation = factor.explanation
        MERGE (d)-[r:INFLUENCED_BY]->(f)
        ON CREATE SET r.impact_score = factor.impact_score
        RETURN count(f) as factors_created
        """

        params = {
            "decision_id": decision_id,
            "org_id": organization_id,
            "factors": factors
        }

        result = await self.neo4j.execute_query(query, params)
        return len(result) > 0

    async def create_person_nodes(
        self,
        decision_id: str,
        organization_id: str,
        people: list[str],
        role: str = "participant"
    ) -> bool:
        """
        Create Person nodes and link them to a Decision.

        SECURITY: Persons are scoped per organization to prevent cross-org data leaks.

        Args:
            decision_id: UUID of the decision
            organization_id: UUID of the organization (REQUIRED)
            people: List of person names
            role: Role in the decision (e.g., "decision_maker", "stakeholder")

        Returns:
            True if successful
        """
        if not organization_id:
            raise ValueError("organization_id is required for multi-tenant isolation")

        query = """
        MATCH (d:Decision {id: $decision_id, organization_id: $org_id})
        UNWIND $people as person_name
        MERGE (p:Person {name: person_name, organization_id: $org_id})
        ON CREATE SET
            p.created_at = datetime()
        MERGE (d)-[r:INVOLVED]->(p)
        ON CREATE SET
            r.role = $role,
            r.created_at = datetime()
        RETURN count(p) as people_linked
        """

        params = {
            "decision_id": decision_id,
            "org_id": organization_id,
            "people": people,
            "role": role
        }

        result = await self.neo4j.execute_query(query, params)
        return len(result) > 0

    async def create_project_node(
        self,
        decision_id: str,
        organization_id: str,
        project_name: str,
        status: str = "active"
    ) -> bool:
        """
        Create a Project node and link it to a Decision.

        SECURITY: Projects are scoped per organization to prevent cross-org data leaks.

        Args:
            decision_id: UUID of the decision
            organization_id: UUID of the organization (REQUIRED)
            project_name: Name of the project
            status: Project status

        Returns:
            True if successful
        """
        if not organization_id:
            raise ValueError("organization_id is required for multi-tenant isolation")

        query = """
        MATCH (d:Decision {id: $decision_id, organization_id: $org_id})
        MERGE (p:Project {name: $project_name, organization_id: $org_id})
        ON CREATE SET
            p.created_at = datetime(),
            p.status = $status
        MERGE (d)-[r:PART_OF]->(p)
        ON CREATE SET r.created_at = datetime()
        RETURN p.name as project
        """

        params = {
            "decision_id": decision_id,
            "org_id": organization_id,
            "project_name": project_name,
            "status": status
        }

        result = await self.neo4j.execute_query(query, params)
        return len(result) > 0

    async def link_decisions(
        self,
        from_decision_id: str,
        to_decision_id: str,
        organization_id: str,
        relationship_type: str = "RELATED_TO"
    ) -> bool:
        """
        Create a relationship between two decisions within the same organization.

        SECURITY: Both decisions must belong to the same organization.

        Args:
            from_decision_id: UUID of the first decision
            to_decision_id: UUID of the second decision
            organization_id: UUID of the organization (REQUIRED)
            relationship_type: Type of relationship (PRECEDED_BY, LED_TO, RELATED_TO)

        Returns:
            True if successful
        """
        if not organization_id:
            raise ValueError("organization_id is required for multi-tenant isolation")

        valid_types = ["PRECEDED_BY", "LED_TO", "RELATED_TO", "ALTERNATIVE_TO"]
        if relationship_type not in valid_types:
            relationship_type = "RELATED_TO"

        # Both decisions must belong to the same organization
        query = f"""
        MATCH (d1:Decision {{id: $from_id, organization_id: $org_id}})
        MATCH (d2:Decision {{id: $to_id, organization_id: $org_id}})
        MERGE (d1)-[r:{relationship_type}]->(d2)
        ON CREATE SET r.created_at = datetime()
        RETURN type(r) as relationship
        """

        params = {
            "from_id": from_decision_id,
            "to_id": to_decision_id,
            "org_id": organization_id
        }

        result = await self.neo4j.execute_query(query, params)
        return len(result) > 0

    async def populate_complete_decision(
        self,
        decision_id: str,
        organization_id: str,
        decision_data: dict,
        entities: dict,
        factors: list[dict]
    ) -> dict:
        """
        Populate the graph with a complete decision including all relationships.

        SECURITY: All nodes are scoped to the organization.

        Args:
            decision_id: UUID of the decision
            organization_id: UUID of the organization (REQUIRED)
            decision_data: Decision information (title, description, etc.)
            entities: Extracted entities (people, projects, dates)
            factors: Analyzed factors

        Returns:
            Summary of created nodes and relationships
        """
        if not organization_id:
            raise ValueError("organization_id is required for multi-tenant isolation")

        summary = {
            "decision_created": False,
            "factors_created": 0,
            "people_linked": 0,
            "projects_linked": 0
        }

        # Create decision node
        decision_created = await self.create_decision_node(
            decision_id=decision_id,
            title=decision_data["title"],
            description=decision_data["description"],
            created_at=decision_data["created_at"],
            user_id=decision_data["user_id"],
            organization_id=organization_id,
            metadata=decision_data.get("metadata", {})
        )
        summary["decision_created"] = decision_created

        # Create factor nodes
        if factors:
            factors_created = await self.create_factor_nodes(
                decision_id, organization_id, factors
            )
            summary["factors_created"] = len(factors) if factors_created else 0

        # Create person nodes
        if entities.get("people"):
            people_linked = await self.create_person_nodes(
                decision_id,
                organization_id,
                entities["people"]
            )
            summary["people_linked"] = len(entities["people"]) if people_linked else 0

        # Create project nodes
        if entities.get("projects"):
            for project in entities["projects"]:
                await self.create_project_node(decision_id, organization_id, project)
                summary["projects_linked"] += 1

        return summary

    async def update_decision_metadata(
        self,
        decision_id: str,
        organization_id: str,
        metadata: dict
    ) -> bool:
        """
        Update metadata properties of a decision node.

        SECURITY: Validates organization ownership before update.

        Args:
            decision_id: UUID of the decision
            organization_id: UUID of the organization (REQUIRED)
            metadata: Dictionary of properties to update

        Returns:
            True if successful
        """
        if not organization_id:
            raise ValueError("organization_id is required for multi-tenant isolation")

        query = """
        MATCH (d:Decision {id: $decision_id, organization_id: $org_id})
        SET d += $metadata
        SET d.updated_at = datetime()
        RETURN d.id as id
        """

        params = {
            "decision_id": decision_id,
            "org_id": organization_id,
            "metadata": metadata
        }

        result = await self.neo4j.execute_query(query, params)
        return len(result) > 0

    async def delete_decision_node(
        self,
        decision_id: str,
        organization_id: str
    ) -> bool:
        """
        Delete a decision node and all its relationships.

        SECURITY: Validates organization ownership before deletion.

        Args:
            decision_id: UUID of the decision
            organization_id: UUID of the organization (REQUIRED)

        Returns:
            True if successful
        """
        if not organization_id:
            raise ValueError("organization_id is required for multi-tenant isolation")

        query = """
        MATCH (d:Decision {id: $decision_id, organization_id: $org_id})
        DETACH DELETE d
        RETURN count(d) as deleted
        """

        result = await self.neo4j.execute_query(
            query,
            {"decision_id": decision_id, "org_id": organization_id}
        )

        return len(result) > 0 and result[0].get("deleted", 0) > 0
