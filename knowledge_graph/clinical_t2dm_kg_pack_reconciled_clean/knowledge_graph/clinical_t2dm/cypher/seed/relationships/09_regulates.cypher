// One statement. Static relationship type REGULATES; compatible without dynamic relationship-type syntax.
// This creates/updates 1 candidate edge(s), not AI-approved evidence.
UNWIND [
  {
    "from": "Insulin",
    "to": "Blood Glucose",
    "sourceRefs": [
      "[7]",
      "[11]",
      "[17]",
      "[26]"
    ],
    "evidenceNote": "Insulin participates in physiological glucose regulation; treatment effects depend on formulation, dose, delivery and the individual."
  }
 ] AS item
MATCH (a:MedicalConcept {name: item.from})
MATCH (b:MedicalConcept {name: item.to})
MERGE (a)-[r:REGULATES]->(b)
SET r.sourceRefs = item.sourceRefs,
    r.evidenceNote = item.evidenceNote,
    r.evidenceType = 'literature',
    r.evidenceStatus = 'candidate_for_review',
    r.scope = 'Type 2 Diabetes',
    r.schemaVersion = 't2dm-medical-kg-v1'
RETURN count(r) AS relationshipsProcessed;
