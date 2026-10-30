// Expected result: 0 rows. Candidate status is permitted here, but every edge needs sources and an evidence note.
MATCH (a:MedicalConcept)-[r]->(b:MedicalConcept)
WHERE r.sourceRefs IS NULL OR size(r.sourceRefs) = 0 OR r.evidenceNote IS NULL OR trim(r.evidenceNote) = ''
RETURN a.name AS subject, type(r) AS predicate, b.name AS object, r.sourceRefs AS sourceRefs, r.evidenceNote AS evidenceNote, r.evidenceStatus AS evidenceStatus;
