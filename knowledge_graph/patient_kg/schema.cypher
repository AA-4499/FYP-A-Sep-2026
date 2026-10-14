// Run this statement in Neo4j Browser at http://localhost:7475.
CREATE CONSTRAINT patient_kg_patient_id IF NOT EXISTS
FOR (p:Patient) REQUIRE p.patientId IS UNIQUE;

// Run this statement separately.
CREATE CONSTRAINT patient_kg_condition_id IF NOT EXISTS
FOR (c:Condition) REQUIRE c.conditionId IS UNIQUE;
