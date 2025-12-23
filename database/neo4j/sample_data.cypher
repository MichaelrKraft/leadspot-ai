// Sample data structure for testing
// Organization
CREATE (org:Organization {id: 'org-001', name: 'Huron Consulting', domain: 'huronconsultinggroup.com'})

// People
CREATE (p1:Person {id: 'person-001', name: 'Jane Doe', email: 'jane@huronconsulting.com', organization_id: 'org-001'})
CREATE (p2:Person {id: 'person-002', name: 'John Smith', email: 'john@huronconsulting.com', organization_id: 'org-001'})

// Documents
CREATE (doc1:Document {
    id: 'doc-001',
    title: 'Vendor Comparison Spreadsheet',
    source_system: 'gdrive',
    organization_id: 'org-001',
    created_at: datetime('2024-01-15T10:30:00Z')
})

// Decision
CREATE (decision1:Decision {
    id: 'decision-001',
    name: 'Choose Vendor A',
    description: 'Selected Vendor A for Project Phoenix engagement',
    organization_id: 'org-001',
    made_at: datetime('2024-02-15T14:00:00Z')
})

// Events
CREATE (event1:Event {
    id: 'event-001',
    type: 'document_created',
    title: 'Initial vendor list compiled',
    timestamp: datetime('2024-01-15T10:30:00Z'),
    organization_id: 'org-001'
})

// Relationships
CREATE (p1)-[:AUTHORED]->(doc1)
CREATE (event1)-[:INFLUENCED]->(decision1)
CREATE (doc1)-[:REFERENCED_IN]->(decision1)
