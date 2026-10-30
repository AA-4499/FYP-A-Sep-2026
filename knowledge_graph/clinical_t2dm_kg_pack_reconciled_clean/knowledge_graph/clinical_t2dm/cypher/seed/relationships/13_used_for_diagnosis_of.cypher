// One statement. Static relationship type USED_FOR_DIAGNOSIS_OF; compatible without dynamic relationship-type syntax.
// This creates/updates 2 candidate edge(s), not AI-approved evidence.
UNWIND [
  {
    "from": "HbA1c",
    "to": "Diabetes",
    "sourceRefs": [
      "[9]",
      "[23]"
    ],
    "evidenceNote": "A1C is one accepted laboratory criterion for diabetes diagnosis when performed and interpreted under the applicable guideline."
  },
  {
    "from": "Fasting Plasma Glucose",
    "to": "Diabetes",
    "sourceRefs": [
      "[23]"
    ],
    "evidenceNote": "Fasting plasma glucose is one accepted plasma-glucose criterion for diagnosis, subject to confirmatory testing and clinical context."
  }
 ] AS item
MATCH (a:MedicalConcept {name: item.from})
MATCH (b:MedicalConcept {name: item.to})
MERGE (a)-[r:USED_FOR_DIAGNOSIS_OF]->(b)
SET r.sourceRefs = item.sourceRefs,
    r.evidenceNote = item.evidenceNote,
    r.evidenceType = 'literature',
    r.evidenceStatus = 'candidate_for_review',
    r.scope = 'Type 2 Diabetes',
    r.schemaVersion = 't2dm-medical-kg-v1'
RETURN count(r) AS relationshipsProcessed;
