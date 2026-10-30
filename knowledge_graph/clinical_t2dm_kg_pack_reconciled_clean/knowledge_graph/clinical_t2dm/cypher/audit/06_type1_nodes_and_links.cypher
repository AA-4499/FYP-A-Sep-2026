// READ ONLY. Search common patient, concept, event, and dataset/source fields for Type 1 markers, plus incident relationships.
// Run the server-version audit first; this query uses explicit properties to remain compatible with older Cypher releases.
MATCH (n)
WHERE any(value IN [n.name, n.condition, n.conditionName, n.diabetesType, n.diabetes_type, n.type_of_diabetes, n.source, n.dataset, n.sourceDataset, n.patientType, n.description, n.label]
          WHERE value IS NOT NULL AND any(term IN ['type 1 diabetes','type1 diabetes','type i diabetes','t1dm','t1d'] WHERE toLower(toString(value)) CONTAINS term))
OPTIONAL MATCH (n)-[r]-(other)
RETURN labels(n) AS nodeLabels, properties(n) AS nodeProperties,
       type(r) AS relationship, labels(other) AS otherLabels, properties(other) AS otherProperties;
