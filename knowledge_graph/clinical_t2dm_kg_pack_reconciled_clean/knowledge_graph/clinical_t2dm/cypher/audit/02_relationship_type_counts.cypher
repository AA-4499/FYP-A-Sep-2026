// READ ONLY. Inventory every relationship type before making changes.
MATCH ()-[r]->()
RETURN type(r) AS relationshipType, count(*) AS relationshipCount
ORDER BY relationshipCount DESC, relationshipType;
