// READ ONLY. If this returns any rows, STOP before cleanup and plan duplicate consolidation.
MATCH (c:MedicalConcept)
WITH c.name AS name, collect(c) AS matches
WHERE name IS NULL OR size(matches) > 1
RETURN name, size(matches) AS count, [n IN matches | properties(n)] AS nodeProperties
ORDER BY name;
