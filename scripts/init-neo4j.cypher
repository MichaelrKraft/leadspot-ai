// InnoSynth.ai Neo4j Initialization Script
// This script sets up the graph database schema and indexes

// Create constraints for unique IDs
CREATE CONSTRAINT organization_id IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE;
CREATE CONSTRAINT document_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE;
CREATE CONSTRAINT concept_id IF NOT EXISTS FOR (c:Concept) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE;
CREATE CONSTRAINT topic_id IF NOT EXISTS FOR (t:Topic) REQUIRE t.id IS UNIQUE;

// Create indexes for common queries
CREATE INDEX organization_slug IF NOT EXISTS FOR (o:Organization) ON (o.slug);
CREATE INDEX document_name IF NOT EXISTS FOR (d:Document) ON (d.name);
CREATE INDEX concept_name IF NOT EXISTS FOR (c:Concept) ON (c.name);
CREATE INDEX entity_name IF NOT EXISTS FOR (e:Entity) ON (e.name);
CREATE INDEX topic_name IF NOT EXISTS FOR (t:Topic) ON (t.name);

// Create full-text search indexes
CALL db.index.fulltext.createNodeIndex(
    'conceptSearch',
    ['Concept'],
    ['name', 'description'],
    {analyzer: 'standard-folding'}
) IF NOT EXISTS;

CALL db.index.fulltext.createNodeIndex(
    'entitySearch',
    ['Entity'],
    ['name', 'description'],
    {analyzer: 'standard-folding'}
) IF NOT EXISTS;

CALL db.index.fulltext.createNodeIndex(
    'topicSearch',
    ['Topic'],
    ['name', 'description'],
    {analyzer: 'standard-folding'}
) IF NOT EXISTS;

// Node Structure Documentation
// ===========================
//
// Organization Node
// - id: UUID (matches PostgreSQL organizations.id)
// - slug: String
// - name: String
// - createdAt: DateTime
//
// Document Node
// - id: UUID (matches PostgreSQL documents.id)
// - name: String
// - type: String
// - uploadedAt: DateTime
//
// Concept Node
// - id: UUID
// - name: String
// - description: String
// - category: String
// - confidence: Float (0-1)
//
// Entity Node
// - id: UUID
// - name: String
// - type: String (person, organization, location, etc.)
// - description: String
//
// Topic Node
// - id: UUID
// - name: String
// - description: String
// - weight: Float
//
// Relationship Types
// ==================
//
// (Organization)-[:OWNS]->(Document)
// (Document)-[:CONTAINS]->(Concept)
// (Document)-[:MENTIONS]->(Entity)
// (Document)-[:DISCUSSES]->(Topic)
// (Concept)-[:RELATES_TO {strength: Float}]->(Concept)
// (Concept)-[:PART_OF]->(Topic)
// (Entity)-[:ASSOCIATED_WITH {context: String}]->(Entity)
// (Topic)-[:SUBTOPIC_OF {relevance: Float}]->(Topic)

// Create demo organization
MERGE (o:Organization {id: 'demo-org-uuid'})
SET o.slug = 'demo-org',
    o.name = 'Demo Organization',
    o.createdAt = datetime()
RETURN o;

// Success message
RETURN 'InnoSynth.ai Neo4j graph database initialized successfully!' as message;
