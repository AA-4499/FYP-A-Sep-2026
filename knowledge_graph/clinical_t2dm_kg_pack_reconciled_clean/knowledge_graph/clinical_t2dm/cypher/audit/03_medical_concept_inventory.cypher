// READ ONLY. Review all current MedicalConcept nodes and evidence metadata.
MATCH (c:MedicalConcept)
RETURN c.name AS name, c.category AS category, c.sourceRefs AS sourceRefs, properties(c) AS allProperties
ORDER BY name;
