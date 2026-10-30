// One statement. Static relationship type USED_TO_ASSESS; compatible without dynamic relationship-type syntax.
// This creates/updates 4 candidate edge(s), not AI-approved evidence.
UNWIND [
  {
    "from": "BMI",
    "to": "Obesity",
    "sourceRefs": [
      "[21]",
      "[25]"
    ],
    "evidenceNote": "BMI is commonly used to screen for and classify overweight/obesity; it is a proxy measure and does not directly measure adiposity."
  },
  {
    "from": "HbA1c",
    "to": "Glycaemic Control",
    "sourceRefs": [
      "[9]",
      "[18]",
      "[20]"
    ],
    "evidenceNote": "HbA1c is one measure used to assess glycaemic status; it must be interpreted with patient context and limitations."
  },
  {
    "from": "Postprandial Glucose",
    "to": "Glycaemic Control",
    "sourceRefs": [
      "[18]",
      "[20]"
    ],
    "evidenceNote": "Postprandial glucose can provide additional information when assessing glycaemic management."
  },
  {
    "from": "eGFR",
    "to": "Chronic Kidney Disease",
    "sourceRefs": [
      "[27]"
    ],
    "evidenceNote": "eGFR is one measure used in kidney assessment; it should be interpreted with repeat testing, albuminuria and clinical context as appropriate."
  }
 ] AS item
MATCH (a:MedicalConcept {name: item.from})
MATCH (b:MedicalConcept {name: item.to})
MERGE (a)-[r:USED_TO_ASSESS]->(b)
SET r.sourceRefs = item.sourceRefs,
    r.evidenceNote = item.evidenceNote,
    r.evidenceType = 'literature',
    r.evidenceStatus = 'candidate_for_review',
    r.scope = 'Type 2 Diabetes',
    r.schemaVersion = 't2dm-medical-kg-v1'
RETURN count(r) AS relationshipsProcessed;
