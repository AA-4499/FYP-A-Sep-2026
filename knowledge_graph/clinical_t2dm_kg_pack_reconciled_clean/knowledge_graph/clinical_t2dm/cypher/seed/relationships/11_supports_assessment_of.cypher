// One statement. Static relationship type SUPPORTS_ASSESSMENT_OF; compatible without dynamic relationship-type syntax.
// This creates/updates 3 candidate edge(s), not AI-approved evidence.
UNWIND [
  {
    "from": "Blood Glucose",
    "to": "Hypoglycemia",
    "sourceRefs": [
      "[10]",
      "[20]"
    ],
    "evidenceNote": "Measured glucose supports assessment and classification of hypoglycaemia when interpreted with the relevant guideline thresholds; v1 intentionally stores no numeric threshold."
  },
  {
    "from": "Blood Glucose",
    "to": "Hyperglycemia",
    "sourceRefs": [
      "[18]",
      "[20]"
    ],
    "evidenceNote": "Glucose measurements support assessment of hyperglycaemia; applicable thresholds depend on measurement setting and clinical context."
  },
  {
    "from": "Blood Ketone",
    "to": "Diabetic Ketoacidosis",
    "sourceRefs": [
      "[29]"
    ],
    "evidenceNote": "Ketone measurements support assessment of suspected ketoacidosis but do not diagnose DKA on their own."
  }
 ] AS item
MATCH (a:MedicalConcept {name: item.from})
MATCH (b:MedicalConcept {name: item.to})
MERGE (a)-[r:SUPPORTS_ASSESSMENT_OF]->(b)
SET r.sourceRefs = item.sourceRefs,
    r.evidenceNote = item.evidenceNote,
    r.evidenceType = 'literature',
    r.evidenceStatus = 'candidate_for_review',
    r.scope = 'Type 2 Diabetes',
    r.schemaVersion = 't2dm-medical-kg-v1'
RETURN count(r) AS relationshipsProcessed;
