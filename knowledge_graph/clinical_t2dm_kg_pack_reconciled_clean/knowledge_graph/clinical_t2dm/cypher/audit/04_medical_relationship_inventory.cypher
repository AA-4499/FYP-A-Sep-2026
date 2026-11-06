// READ ONLY. Review current concept-to-concept edge directions and citation properties.
MATCH (a:MedicalConcept)-[r]->(b:MedicalConcept)
RETURN a.name AS fromConcept, type(r) AS relationship, b.name AS toConcept, r.sourceRefs AS sourceRefs, r.evidenceType AS evidenceType, properties(r) AS allProperties
ORDER BY fromConcept, relationship, toConcept;
