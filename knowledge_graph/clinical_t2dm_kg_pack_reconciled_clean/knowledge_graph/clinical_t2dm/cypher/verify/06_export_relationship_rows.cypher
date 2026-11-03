// EXPORT ONLY THE APPROVED MEDICAL KNOWLEDGE GRAPH. In Browser export result rows as CSV for offline review.
MATCH (a:MedicalConcept)-[r]->(b:MedicalConcept)
RETURN a.name AS subject, type(r) AS predicate, b.name AS object, r.sourceRefs AS sourceRefs, r.evidenceNote AS evidenceNote, r.evidenceType AS evidenceType, r.evidenceStatus AS evidenceStatus, r.scope AS scope, r.schemaVersion AS schemaVersion
ORDER BY subject, predicate, object;
