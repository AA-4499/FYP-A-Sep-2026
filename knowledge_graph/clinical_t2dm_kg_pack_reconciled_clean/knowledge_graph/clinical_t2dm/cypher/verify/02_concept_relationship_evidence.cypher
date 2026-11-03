// Review all final edges with the source IDs that must be resolvable through references.json.
MATCH (a:MedicalConcept)-[r]->(b:MedicalConcept)
RETURN a.name AS subject, type(r) AS predicate, b.name AS object, r.sourceRefs AS sourceRefs, r.evidenceNote AS evidenceNote, r.evidenceStatus AS evidenceStatus
ORDER BY subject, predicate, object;
