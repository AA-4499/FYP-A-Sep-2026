// READ ONLY. Supply $relevantConceptNames from a backend mapping of the selected Supabase record.
// Returns the selected canonical concepts and any direct neighbor whose connecting relationship is reviewed.
UNWIND $relevantConceptNames AS conceptName
MATCH (anchor:MedicalConcept {name: conceptName})
OPTIONAL MATCH (anchor)-[r]-(neighbor:MedicalConcept)
WHERE r.evidenceStatus = 'reviewed'
WITH collect(DISTINCT anchor) + collect(DISTINCT neighbor) AS candidates
UNWIND candidates AS c
WITH DISTINCT c
WHERE c IS NOT NULL
RETURN c.name AS name, c.category AS category, c.description AS description,
       c.sourceRefs AS sourceRefs, c.scope AS scope, c.schemaVersion AS schemaVersion
ORDER BY category, name;
