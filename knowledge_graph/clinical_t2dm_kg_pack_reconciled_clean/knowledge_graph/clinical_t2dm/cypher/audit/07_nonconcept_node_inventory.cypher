// READ ONLY. These are nodes outside the intended concept-only schema; review the list before deleting.
MATCH (n)
WHERE NOT n:MedicalConcept
RETURN labels(n) AS nodeLabels, count(*) AS nodeCount
ORDER BY nodeCount DESC, nodeLabels;
