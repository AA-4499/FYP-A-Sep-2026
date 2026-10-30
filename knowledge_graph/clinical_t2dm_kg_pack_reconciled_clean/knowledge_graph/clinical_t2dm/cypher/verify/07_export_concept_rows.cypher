// EXPORT ONLY THE MEDICAL CONCEPT CATALOG. Keep references.json alongside this result.
MATCH (c:MedicalConcept)
RETURN c.name AS name, c.category AS category, c.description AS description, c.scope AS scope, c.sourceRefs AS sourceRefs, c.schemaVersion AS schemaVersion
ORDER BY category, name;
