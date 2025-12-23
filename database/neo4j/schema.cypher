// Node constraints - ensure unique IDs
CREATE CONSTRAINT document_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE;
CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT decision_id IF NOT EXISTS FOR (d:Decision) REQUIRE d.id IS UNIQUE;
CREATE CONSTRAINT event_id IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE;
CREATE CONSTRAINT assumption_id IF NOT EXISTS FOR (a:Assumption) REQUIRE a.id IS UNIQUE;
CREATE CONSTRAINT organization_id IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE;

// Indexes for common queries
CREATE INDEX document_org IF NOT EXISTS FOR (d:Document) ON (d.organization_id);
CREATE INDEX document_source IF NOT EXISTS FOR (d:Document) ON (d.source_system);
CREATE INDEX event_timestamp IF NOT EXISTS FOR (e:Event) ON (e.timestamp);
CREATE INDEX decision_name IF NOT EXISTS FOR (d:Decision) ON (d.name);
CREATE INDEX person_email IF NOT EXISTS FOR (p:Person) ON (p.email);

// Full-text search indexes
CREATE FULLTEXT INDEX document_search IF NOT EXISTS FOR (d:Document) ON EACH [d.title, d.content];
CREATE FULLTEXT INDEX decision_search IF NOT EXISTS FOR (d:Decision) ON EACH [d.name, d.description];
