// One statement. Static relationship type MEASURES; compatible without dynamic relationship-type syntax.
// This creates/updates 1 candidate edge(s), not AI-approved evidence.
UNWIND [
  {
    "from": "CBG",
    "to": "Blood Glucose",
    "sourceRefs": [
      "[20]",
      "[23]"
    ],
    "evidenceNote": "Capillary blood glucose is a method for measuring blood glucose; interpretation depends on timing and clinical context."
  }
 ] AS item
MATCH (a:MedicalConcept {name: item.from})
MATCH (b:MedicalConcept {name: item.to})
MERGE (a)-[r:MEASURES]->(b)
SET r.sourceRefs = item.sourceRefs,
    r.evidenceNote = item.evidenceNote,
    r.evidenceType = 'literature',
    r.evidenceStatus = 'candidate_for_review',
    r.scope = 'Type 2 Diabetes',
    r.schemaVersion = 't2dm-medical-kg-v1'
RETURN count(r) AS relationshipsProcessed;
