// DESTRUCTIVE. Run only after 01_delete_existing_relationships.cypher and a private backup.
// Delete non-concept nodes AND any multi-labelled node; the target schema is a single :MedicalConcept label only.
MATCH (n)
WHERE NOT n:MedicalConcept OR any(label IN labels(n) WHERE label <> 'MedicalConcept')
DETACH DELETE n;
