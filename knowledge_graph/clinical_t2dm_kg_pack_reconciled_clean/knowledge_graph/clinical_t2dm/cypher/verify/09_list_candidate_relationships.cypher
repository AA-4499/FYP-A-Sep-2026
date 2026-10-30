// Human review queue. Expected during initial installation: the proposed relationships seeded from the catalog.
MATCH (a:MedicalConcept)-[r]->(b:MedicalConcept)
WHERE r.evidenceStatus = 'candidate_for_review'
RETURN a.name AS subject, type(r) AS predicate, b.name AS object,
       r.sourceRefs AS sourceRefs, r.evidenceNote AS evidenceNote
ORDER BY subject, predicate, object;
