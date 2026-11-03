// One statement. Static relationship type ALTERNATIVE_MARKER_FOR; compatible without dynamic relationship-type syntax.
// This creates/updates 1 candidate edge(s), not AI-approved evidence.
UNWIND [
  {
    "from": "Glycated Albumin",
    "to": "Glycaemic Control",
    "sourceRefs": [
      "[18]",
      "[20]"
    ],
    "evidenceNote": "Glycated albumin may be considered as an alternative validated biomarker in selected monitoring situations; it is not interchangeable with A1C in every context."
  }
 ] AS item
MATCH (a:MedicalConcept {name: item.from})
MATCH (b:MedicalConcept {name: item.to})
MERGE (a)-[r:ALTERNATIVE_MARKER_FOR]->(b)
SET r.sourceRefs = item.sourceRefs,
    r.evidenceNote = item.evidenceNote,
    r.evidenceType = 'literature',
    r.evidenceStatus = 'candidate_for_review',
    r.scope = 'Type 2 Diabetes',
    r.schemaVersion = 't2dm-medical-kg-v1'
RETURN count(r) AS relationshipsProcessed;
