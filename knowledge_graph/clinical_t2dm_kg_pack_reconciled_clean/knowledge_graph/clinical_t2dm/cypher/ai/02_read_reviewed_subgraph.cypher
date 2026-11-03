// READ ONLY. Supply $relevantConceptNames as canonical names derived by the backend from the selected Supabase record.
// Only edges explicitly marked 'reviewed' are eligible for AI use. Seeded candidate_for_review edges return no AI facts until reviewed.
UNWIND $relevantConceptNames AS conceptName
MATCH (anchor:MedicalConcept {name: conceptName})
MATCH (anchor)-[r]-(neighbor:MedicalConcept)
WHERE r.evidenceStatus = 'reviewed'
WITH DISTINCT r, startNode(r) AS subject, endNode(r) AS object
RETURN subject.name AS subject, type(r) AS predicate, object.name AS object,
       r.evidenceNote AS evidenceNote, r.sourceRefs AS sourceRefs,
       r.evidenceType AS evidenceType, r.evidenceStatus AS evidenceStatus,
       r.scope AS scope, r.schemaVersion AS schemaVersion
ORDER BY subject, predicate, object;
