// Expected result: 0 rows. Reference [16] is a Type 1 Diabetes review and is excluded from the Type 2-only relationship evidence.
MATCH (a:MedicalConcept)-[r]->(b:MedicalConcept)
WHERE '[16]' IN coalesce(r.sourceRefs, [])
RETURN a.name AS subject, type(r) AS predicate, b.name AS object, r.sourceRefs AS sourceRefs;
