// One statement. Static relationship type USED_IN_TREATMENT_OF; compatible without dynamic relationship-type syntax.
// This creates/updates 2 candidate edge(s), not AI-approved evidence.
UNWIND [
  {
    "from": "Insulin",
    "to": "Type 2 Diabetes",
    "sourceRefs": [
      "[7]",
      "[17]",
      "[26]"
    ],
    "evidenceNote": "Insulin is a treatment option for some people with Type 2 diabetes; this relationship does not recommend insulin for an individual patient."
  },
  {
    "from": "Medication",
    "to": "Type 2 Diabetes",
    "sourceRefs": [
      "[7]",
      "[15]",
      "[17]",
      "[26]"
    ],
    "evidenceNote": "Glucose-lowering medications are used in Type 2 diabetes management; choice must be individualized by a qualified clinician."
  }
 ] AS item
MATCH (a:MedicalConcept {name: item.from})
MATCH (b:MedicalConcept {name: item.to})
MERGE (a)-[r:USED_IN_TREATMENT_OF]->(b)
SET r.sourceRefs = item.sourceRefs,
    r.evidenceNote = item.evidenceNote,
    r.evidenceType = 'literature',
    r.evidenceStatus = 'candidate_for_review',
    r.scope = 'Type 2 Diabetes',
    r.schemaVersion = 't2dm-medical-kg-v1'
RETURN count(r) AS relationshipsProcessed;
