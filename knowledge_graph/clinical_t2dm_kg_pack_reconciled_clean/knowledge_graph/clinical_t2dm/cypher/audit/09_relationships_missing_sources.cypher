// READ ONLY. A result means a relationship lacks its required evidence metadata.
MATCH (a:MedicalConcept)-[r]->(b:MedicalConcept)
WHERE r.sourceRefs IS NULL OR size(r.sourceRefs) = 0 OR r.evidenceNote IS NULL
RETURN a.name AS fromConcept, type(r) AS relationship, b.name AS toConcept, r.sourceRefs AS sourceRefs, r.evidenceNote AS evidenceNote
ORDER BY fromConcept, relationship, toConcept;
