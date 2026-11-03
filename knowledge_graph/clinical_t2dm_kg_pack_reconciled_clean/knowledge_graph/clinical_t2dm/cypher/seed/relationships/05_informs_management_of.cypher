// One statement. Static relationship type INFORMS_MANAGEMENT_OF; compatible without dynamic relationship-type syntax.
// This creates/updates 2 candidate edge(s), not AI-approved evidence.
UNWIND [
  {
    "from": "Dietary Intake",
    "to": "Type 2 Diabetes",
    "sourceRefs": [
      "[25]"
    ],
    "evidenceNote": "Dietary patterns and individualized nutrition are relevant to diabetes prevention and management; this edge does not prescribe a specific diet."
  },
  {
    "from": "Physical Activity",
    "to": "Type 2 Diabetes",
    "sourceRefs": [
      "[25]"
    ],
    "evidenceNote": "Physical activity is one element considered in Type 2 diabetes and weight-management care; individual goals should be personalized."
  }
 ] AS item
MATCH (a:MedicalConcept {name: item.from})
MATCH (b:MedicalConcept {name: item.to})
MERGE (a)-[r:INFORMS_MANAGEMENT_OF]->(b)
SET r.sourceRefs = item.sourceRefs,
    r.evidenceNote = item.evidenceNote,
    r.evidenceType = 'literature',
    r.evidenceStatus = 'candidate_for_review',
    r.scope = 'Type 2 Diabetes',
    r.schemaVersion = 't2dm-medical-kg-v1'
RETURN count(r) AS relationshipsProcessed;
