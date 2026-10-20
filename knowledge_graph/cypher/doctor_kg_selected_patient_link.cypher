// OPTIONAL selected-patient condition-link repair.
// Use only after the audit and after confirming that this patient node's
// diabetesType property matches an existing MedicalConcept.name value.
// Edit the patientId below to the exact selected Patient Number.
// Run the preview first, then the MERGE statement separately.

// 1. READ-ONLY PREVIEW. Confirm exactly one Patient and one matching concept.
MATCH (p:Patient {patientId: "2000_0_20201230"})
MATCH (d:MedicalConcept {name: p.diabetesType})
RETURN p.patientId AS patientId, p.diabetesType AS recordedType, d.name AS matchedConcept,
       EXISTS { MATCH (p)-[:HAS_CONDITION]->(d) } AS linkAlreadyExists;

// 2. OPTIONAL MUTATION. Run only if the preview shows the correct patient/concept.
// MERGE is idempotent for this typed edge. No patient or concept node is created/deleted.
MATCH (p:Patient {patientId: "2000_0_20201230"})
MATCH (d:MedicalConcept {name: p.diabetesType})
MERGE (p)-[r:HAS_CONDITION]->(d)
SET r.evidenceType = "Patient record",
    r.source = "Patient diabetesType property"
RETURN p.patientId AS patientId, type(r) AS relationship, d.name AS condition;
