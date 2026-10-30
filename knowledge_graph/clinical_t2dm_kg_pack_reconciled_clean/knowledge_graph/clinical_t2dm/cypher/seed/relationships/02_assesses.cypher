// One statement. Static relationship type ASSESSES; compatible without dynamic relationship-type syntax.
// This creates/updates 6 candidate edge(s), not AI-approved evidence.
UNWIND [
  {
    "from": "Mean Glucose",
    "to": "Glycaemic Control",
    "sourceRefs": [
      "[20]",
      "[22]"
    ],
    "evidenceNote": "Mean CGM glucose is one metric used in glycaemic-status assessment."
  },
  {
    "from": "Time in Range",
    "to": "Glycaemic Control",
    "sourceRefs": [
      "[20]",
      "[22]"
    ],
    "evidenceNote": "Time in range is one metric used in glycaemic-status assessment; goals depend on individual clinical context."
  },
  {
    "from": "Time Below Range",
    "to": "Glycaemic Control",
    "sourceRefs": [
      "[20]",
      "[22]"
    ],
    "evidenceNote": "Time below range supports assessment of low-glucose exposure and hypoglycaemia risk."
  },
  {
    "from": "Time Above Range",
    "to": "Glycaemic Control",
    "sourceRefs": [
      "[20]",
      "[22]"
    ],
    "evidenceNote": "Time above range supports assessment of elevated-glucose exposure."
  },
  {
    "from": "Glucose Management Indicator",
    "to": "Glycaemic Control",
    "sourceRefs": [
      "[20]",
      "[22]"
    ],
    "evidenceNote": "GMI is a CGM-derived estimate related to average glucose; it should not be treated as an exact replacement for laboratory HbA1c."
  },
  {
    "from": "Glycaemic Variability",
    "to": "Glycaemic Control",
    "sourceRefs": [
      "[20]",
      "[22]"
    ],
    "evidenceNote": "Glucose variability is one aspect of CGM interpretation and should be considered alongside other metrics."
  }
 ] AS item
MATCH (a:MedicalConcept {name: item.from})
MATCH (b:MedicalConcept {name: item.to})
MERGE (a)-[r:ASSESSES]->(b)
SET r.sourceRefs = item.sourceRefs,
    r.evidenceNote = item.evidenceNote,
    r.evidenceType = 'literature',
    r.evidenceStatus = 'candidate_for_review',
    r.scope = 'Type 2 Diabetes',
    r.schemaVersion = 't2dm-medical-kg-v1'
RETURN count(r) AS relationshipsProcessed;
