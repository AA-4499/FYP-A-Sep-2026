// Expected result: 0 rows. Checks Type 1 markers in common identity, condition and dataset/source fields.
MATCH (n)
WHERE any(value IN [n.name, n.condition, n.conditionName, n.diabetesType, n.diabetes_type, n.type_of_diabetes, n.source, n.dataset, n.sourceDataset, n.patientType, n.description, n.label]
          WHERE value IS NOT NULL AND any(term IN ['type 1 diabetes','type1 diabetes','type i diabetes','t1dm','t1d'] WHERE toLower(toString(value)) CONTAINS term))
RETURN labels(n) AS labels, properties(n) AS properties;
