// One statement. Static relationship type RISK_FACTOR_FOR; compatible without dynamic relationship-type syntax.
// This creates/updates 2 candidate edge(s), not AI-approved evidence.
UNWIND [
  {
    "from": "Prediabetes",
    "to": "Type 2 Diabetes",
    "sourceRefs": [
      "[13]",
      "[23]"
    ],
    "evidenceNote": "Prediabetes is a high-risk state for future Type 2 diabetes development; it does not imply that progression is inevitable."
  },
  {
    "from": "Obesity",
    "to": "Type 2 Diabetes",
    "sourceRefs": [
      "[1]",
      "[2]",
      "[3]",
      "[4]",
      "[6]",
      "[17]",
      "[25]"
    ],
    "evidenceNote": "Population evidence and reviews associate obesity with increased Type 2 diabetes risk. This is not a patient-specific diagnosis or proof of causation in an individual."
  }
 ] AS item
MATCH (a:MedicalConcept {name: item.from})
MATCH (b:MedicalConcept {name: item.to})
MERGE (a)-[r:RISK_FACTOR_FOR]->(b)
SET r.sourceRefs = item.sourceRefs,
    r.evidenceNote = item.evidenceNote,
    r.evidenceType = 'literature',
    r.evidenceStatus = 'candidate_for_review',
    r.scope = 'Type 2 Diabetes',
    r.schemaVersion = 't2dm-medical-kg-v1'
RETURN count(r) AS relationshipsProcessed;
