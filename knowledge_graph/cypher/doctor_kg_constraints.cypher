// Optional constraints for the Doctor Knowledge Graph.
// BEFORE running: first run doctor_kg_audit.cypher and confirm duplicate Patient
// patientId and duplicate MedicalConcept name query blocks return zero rows.
// If either query returns duplicates, review/reconcile them manually after taking
// a Neo4j Aura backup. Do not blindly delete nodes to make constraints pass.

// Run the following statements separately.
CREATE CONSTRAINT patient_id_unique IF NOT EXISTS
FOR (p:Patient)
REQUIRE p.patientId IS UNIQUE;

// Run separately.
CREATE CONSTRAINT concept_name_unique IF NOT EXISTS
FOR (c:MedicalConcept)
REQUIRE c.name IS UNIQUE;

// Verify constraints.
SHOW CONSTRAINTS;
