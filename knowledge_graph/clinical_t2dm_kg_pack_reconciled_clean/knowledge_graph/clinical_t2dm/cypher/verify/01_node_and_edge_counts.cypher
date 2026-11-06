// Returns node counts by label and relationship counts by type; expected node labels are only MedicalConcept.
MATCH (n)
WITH labels(n) AS elementLabels, count(*) AS itemCount
RETURN 'node' AS elementType, elementLabels, itemCount
UNION ALL
MATCH ()-[r]->()
WITH [type(r)] AS elementLabels, count(*) AS itemCount
RETURN 'relationship' AS elementType, elementLabels, itemCount
ORDER BY elementType, elementLabels;
