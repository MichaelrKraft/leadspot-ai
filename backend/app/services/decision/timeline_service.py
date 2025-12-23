"""Timeline reconstruction service using Neo4j graph database.

SECURITY: All queries include organization_id filtering for multi-tenant isolation.
"""

from app.services.neo4j_service import Neo4jService


class TimelineService:
    """Reconstruct decision timelines from knowledge graph.

    IMPORTANT: All methods require organization_id to enforce multi-tenant isolation.
    """

    def __init__(self, neo4j_service: Neo4jService):
        self.neo4j = neo4j_service

    async def get_decision_timeline(
        self,
        decision_id: str,
        organization_id: str,
        include_related: bool = True
    ) -> list[dict]:
        """
        Get chronological timeline of events related to a decision.

        SECURITY: Only returns data within the specified organization.

        Args:
            decision_id: UUID of the decision
            organization_id: UUID of the organization (REQUIRED)
            include_related: Whether to include related decisions and events

        Returns:
            List of timeline events ordered chronologically
        """
        if not organization_id:
            raise ValueError("organization_id is required for multi-tenant isolation")

        query = """
        MATCH (d:Decision {id: $decision_id, organization_id: $org_id})
        OPTIONAL MATCH (d)-[:PRECEDED_BY]->(prior:Decision {organization_id: $org_id})
        OPTIONAL MATCH (d)-[:LED_TO]->(consequence:Decision {organization_id: $org_id})
        OPTIONAL MATCH (d)-[:INFLUENCED_BY]->(factor:Factor {organization_id: $org_id})
        OPTIONAL MATCH (d)-[:INVOLVED]->(person:Person {organization_id: $org_id})
        OPTIONAL MATCH (d)-[:PART_OF]->(project:Project {organization_id: $org_id})

        RETURN
            d.created_at as decision_date,
            d.title as decision_title,
            collect(DISTINCT {
                type: 'prior_decision',
                title: prior.title,
                date: prior.created_at
            }) as prior_decisions,
            collect(DISTINCT {
                type: 'consequence',
                title: consequence.title,
                date: consequence.created_at
            }) as consequences,
            collect(DISTINCT {
                type: 'factor',
                name: factor.name,
                impact: factor.impact_score
            }) as factors,
            collect(DISTINCT {
                type: 'person',
                name: person.name,
                role: person.role
            }) as people,
            collect(DISTINCT {
                type: 'project',
                name: project.name,
                status: project.status
            }) as projects
        """

        result = await self.neo4j.execute_query(
            query, {"decision_id": decision_id, "org_id": organization_id}
        )

        if not result:
            return []

        # Flatten and sort timeline events
        timeline = []
        data = result[0]

        # Add main decision
        timeline.append({
            "date": data["decision_date"],
            "type": "decision",
            "title": data["decision_title"],
            "is_main": True
        })

        # Add prior decisions
        if include_related:
            for prior in data.get("prior_decisions", []):
                if prior.get("title"):
                    timeline.append({
                        "date": prior["date"],
                        "type": "prior_decision",
                        "title": prior["title"],
                        "relationship": "preceded"
                    })

            # Add consequences
            for consequence in data.get("consequences", []):
                if consequence.get("title"):
                    timeline.append({
                        "date": consequence["date"],
                        "type": "consequence",
                        "title": consequence["title"],
                        "relationship": "resulted_from"
                    })

        # Sort by date
        timeline.sort(key=lambda x: x.get("date", ""))

        return timeline

    async def find_related_decisions(
        self,
        decision_id: str,
        organization_id: str,
        max_depth: int = 2
    ) -> list[dict]:
        """
        Find decisions related through the knowledge graph within an organization.

        SECURITY: Only returns decisions within the same organization.

        Args:
            decision_id: UUID of the decision
            organization_id: UUID of the organization (REQUIRED)
            max_depth: Maximum graph traversal depth

        Returns:
            List of related decisions with relationship type
        """
        if not organization_id:
            raise ValueError("organization_id is required for multi-tenant isolation")

        query = f"""
        MATCH (d:Decision {{id: $decision_id, organization_id: $org_id}})
        MATCH path = (d)-[*1..{max_depth}]-(related:Decision {{organization_id: $org_id}})
        WHERE d <> related
        RETURN DISTINCT
            related.id as id,
            related.title as title,
            related.created_at as date,
            [r in relationships(path) | type(r)] as relationships,
            length(path) as distance
        ORDER BY distance, date DESC
        LIMIT 20
        """

        results = await self.neo4j.execute_query(
            query, {"decision_id": decision_id, "org_id": organization_id}
        )

        related = []
        for record in results:
            related.append({
                "id": record["id"],
                "title": record["title"],
                "date": record["date"],
                "relationships": record["relationships"],
                "distance": record["distance"]
            })

        return related

    async def get_project_timeline(
        self,
        project_name: str,
        organization_id: str
    ) -> list[dict]:
        """
        Get all decisions related to a specific project within an organization.

        SECURITY: Only returns decisions within the specified organization.

        Args:
            project_name: Name of the project
            organization_id: UUID of the organization (REQUIRED)

        Returns:
            Chronological list of project decisions
        """
        if not organization_id:
            raise ValueError("organization_id is required for multi-tenant isolation")

        query = """
        MATCH (p:Project {name: $project_name, organization_id: $org_id})
        MATCH (d:Decision {organization_id: $org_id})-[:PART_OF]->(p)
        OPTIONAL MATCH (d)-[:INVOLVED]->(person:Person {organization_id: $org_id})
        RETURN
            d.id as id,
            d.title as title,
            d.created_at as date,
            d.description as description,
            collect(DISTINCT person.name) as people
        ORDER BY d.created_at
        """

        results = await self.neo4j.execute_query(
            query,
            {"project_name": project_name, "org_id": organization_id}
        )

        timeline = []
        for record in results:
            timeline.append({
                "id": record["id"],
                "title": record["title"],
                "date": record["date"],
                "description": record["description"],
                "people": record["people"]
            })

        return timeline

    async def get_person_decisions(
        self,
        person_name: str,
        organization_id: str
    ) -> list[dict]:
        """
        Get all decisions a person was involved in within an organization.

        SECURITY: Only returns decisions within the specified organization.

        Args:
            person_name: Name of the person
            organization_id: UUID of the organization (REQUIRED)

        Returns:
            List of decisions with involvement details
        """
        if not organization_id:
            raise ValueError("organization_id is required for multi-tenant isolation")

        query = """
        MATCH (person:Person {name: $person_name, organization_id: $org_id})
        MATCH (d:Decision {organization_id: $org_id})-[:INVOLVED]->(person)
        OPTIONAL MATCH (d)-[:PART_OF]->(project:Project {organization_id: $org_id})
        RETURN
            d.id as id,
            d.title as title,
            d.created_at as date,
            person.role as role,
            project.name as project
        ORDER BY d.created_at DESC
        """

        results = await self.neo4j.execute_query(
            query,
            {"person_name": person_name, "org_id": organization_id}
        )

        decisions = []
        for record in results:
            decisions.append({
                "id": record["id"],
                "title": record["title"],
                "date": record["date"],
                "role": record["role"],
                "project": record["project"]
            })

        return decisions
