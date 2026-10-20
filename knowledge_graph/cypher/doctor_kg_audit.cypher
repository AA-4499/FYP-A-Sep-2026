// READ-ONLY AUDIT — run each query block separately in Neo4j Browser.
// These checks do not alter the Aura database.

// 1. Current node counts by label.
MATCH (n)
UNWIND labels(n) AS label
RETURN label, count(*) AS nodes
ORDER BY nodes DESC, label;

// 2. Current relationship counts by type.
MATCH ()-[r]->()
RETURN type(r) AS relationship, count(*) AS total
ORDER BY total DESC, relationship;

// 3. Inventory of the reusable MedicalConcept ontology.
MATCH (c:MedicalConcept)
RETURN c.name AS concept, c.category AS category, c.sourceRefs AS sourceRefs
ORDER BY category, concept;

// 4. Literature-backed concept relationships and their evidence metadata.
MATCH (a:MedicalConcept)-[r]->(b:MedicalConcept)
RETURN a.name AS from, type(r) AS relationship, b.name AS to,
       r.sourceRefs AS sourceRefs, r.evidenceType AS evidenceType
ORDER BY from, relationship, to;

// 5. Duplicate MedicalConcept names. Review this output before adding uniqueness constraints.
MATCH (c:MedicalConcept)
WITH c.name AS name, collect(c) AS concepts
WHERE name IS NOT NULL AND size(concepts) > 1
RETURN name, size(concepts) AS duplicateCount,
       [c IN concepts | properties(c)] AS nodeProperties;

// 6. Duplicate Patient identifiers. Review this output before adding uniqueness constraints.
MATCH (p:Patient)
WITH p.patientId AS patientId, collect(p) AS patients
WHERE patientId IS NOT NULL AND size(patients) > 1
RETURN patientId, size(patients) AS duplicateCount,
       [p IN patients | properties(p)] AS nodeProperties;

// 7. Patients and their direct graph relationships. This may return many rows.
MATCH (p:Patient)-[r]-(n)
RETURN p.patientId AS patientId, type(r) AS relationship,
       labels(n) AS neighbourLabels, coalesce(n.name, n.eventId, n.readingId, n.measurementId) AS neighbour,
       r.sourceRefs AS sourceRefs
ORDER BY patientId, relationship
LIMIT 250;

// 8. Patient nodes that currently have no relationships.
MATCH (p:Patient)
WHERE NOT (p)--()
RETURN p.patientId AS patientId, properties(p) AS patientProperties
ORDER BY patientId;

// 9. Orphan MedicalConcept nodes with no relationships. They may be intentional but should be reviewed.
MATCH (c:MedicalConcept)
WHERE NOT (c)--()
RETURN c.name AS concept, c.category AS category, c.sourceRefs AS sourceRefs
ORDER BY category, concept;

// 10. Check the patient record selected for the doctor page.
// Change the ID to the exact Patient Number selected in the app.
MATCH (p:Patient {patientId: "2000_0_20201230"})
OPTIONAL MATCH (p)-[r]-(n)
RETURN p, r, n
LIMIT 100;
