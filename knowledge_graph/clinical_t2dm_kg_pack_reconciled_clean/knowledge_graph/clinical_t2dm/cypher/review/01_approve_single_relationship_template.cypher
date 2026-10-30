// REVIEW TEMPLATE ONLY. Execute only after reading the cited source and approving this exact edge.
// Supply parameters: $subject, $predicate, $object, $reviewedBy, $reviewNote.
MATCH (a:MedicalConcept {name: $subject})-[r]->(b:MedicalConcept {name: $object})
WHERE type(r) = $predicate AND r.evidenceStatus = 'candidate_for_review'
SET r.evidenceStatus = 'reviewed',
    r.reviewedAt = datetime(),
    r.reviewedBy = $reviewedBy,
    r.reviewNote = $reviewNote
RETURN a.name AS subject, type(r) AS predicate, b.name AS object,
       r.sourceRefs AS sourceRefs, r.evidenceStatus AS evidenceStatus,
       r.reviewedAt AS reviewedAt, r.reviewedBy AS reviewedBy,
       r.reviewNote AS reviewNote;
