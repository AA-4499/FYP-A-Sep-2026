// One statement. Static relationship type MONITORS; compatible without dynamic relationship-type syntax.
// This creates/updates 1 candidate edge(s), not AI-approved evidence.
UNWIND [
  {
    "from": "CGM",
    "to": "Blood Glucose",
    "sourceRefs": [
      "[19]",
      "[20]",
      "[22]",
      "[24]"
    ],
    "evidenceNote": "CGM provides repeated glucose measurements over time and supports interpretation of glucose patterns."
  }
 ] AS item
MATCH (a:MedicalConcept {name: item.from})
MATCH (b:MedicalConcept {name: item.to})
MERGE (a)-[r:MONITORS]->(b)
SET r.sourceRefs = item.sourceRefs,
    r.evidenceNote = item.evidenceNote,
    r.evidenceType = 'literature',
    r.evidenceStatus = 'candidate_for_review',
    r.scope = 'Type 2 Diabetes',
    r.schemaVersion = 't2dm-medical-kg-v1'
RETURN count(r) AS relationshipsProcessed;
