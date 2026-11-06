// Expected result: 0 rows. Enforce the target boundary: one label only, no persisted patient/event identifiers or readings.
MATCH (n)
WHERE labels(n) <> ['MedicalConcept']
   OR any(k IN keys(n) WHERE toLower(k) IN ['patientid','patient_id','patientnumber','patient number','readingid','eventid','timestamp','dose','route','mealid'])
RETURN labels(n) AS labels, properties(n) AS properties;
