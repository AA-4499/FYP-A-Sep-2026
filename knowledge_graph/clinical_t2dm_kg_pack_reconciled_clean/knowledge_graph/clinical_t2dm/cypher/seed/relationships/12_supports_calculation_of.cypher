// One statement. Static relationship type SUPPORTS_CALCULATION_OF; compatible without dynamic relationship-type syntax.
// This creates/updates 6 candidate edge(s), not AI-approved evidence.
UNWIND [
  {
    "from": "CGM",
    "to": "Mean Glucose",
    "sourceRefs": [
      "[20]",
      "[22]",
      "[24]"
    ],
    "evidenceNote": "Mean glucose is a standard CGM-derived metric for a defined monitoring period."
  },
  {
    "from": "CGM",
    "to": "Time in Range",
    "sourceRefs": [
      "[20]",
      "[22]",
      "[24]"
    ],
    "evidenceNote": "Time in range is derived from CGM values and must specify the glucose range and analysis window."
  },
  {
    "from": "CGM",
    "to": "Time Below Range",
    "sourceRefs": [
      "[20]",
      "[22]",
      "[24]"
    ],
    "evidenceNote": "Time below range is derived from CGM values using a specified glucose threshold and analysis window."
  },
  {
    "from": "CGM",
    "to": "Time Above Range",
    "sourceRefs": [
      "[20]",
      "[22]",
      "[24]"
    ],
    "evidenceNote": "Time above range is derived from CGM values using a specified glucose threshold and analysis window."
  },
  {
    "from": "CGM",
    "to": "Glucose Management Indicator",
    "sourceRefs": [
      "[20]",
      "[22]",
      "[24]"
    ],
    "evidenceNote": "GMI is calculated from mean CGM glucose and approximates, but is not always equivalent to, laboratory HbA1c."
  },
  {
    "from": "CGM",
    "to": "Glycaemic Variability",
    "sourceRefs": [
      "[20]",
      "[22]",
      "[24]"
    ],
    "evidenceNote": "CGM time-series values can be used to calculate glucose variability metrics."
  }
 ] AS item
MATCH (a:MedicalConcept {name: item.from})
MATCH (b:MedicalConcept {name: item.to})
MERGE (a)-[r:SUPPORTS_CALCULATION_OF]->(b)
SET r.sourceRefs = item.sourceRefs,
    r.evidenceNote = item.evidenceNote,
    r.evidenceType = 'literature',
    r.evidenceStatus = 'candidate_for_review',
    r.scope = 'Type 2 Diabetes',
    r.schemaVersion = 't2dm-medical-kg-v1'
RETURN count(r) AS relationshipsProcessed;
