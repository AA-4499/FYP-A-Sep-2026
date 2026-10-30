// READ ONLY. Inventory every node label before making changes.
MATCH (n)
UNWIND labels(n) AS label
RETURN label, count(*) AS nodeCount
ORDER BY nodeCount DESC, label;
