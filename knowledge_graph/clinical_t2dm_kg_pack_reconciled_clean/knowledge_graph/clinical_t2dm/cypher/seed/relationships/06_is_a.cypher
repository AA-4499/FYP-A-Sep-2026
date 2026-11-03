// One statement. Static relationship type IS_A; compatible without dynamic relationship-type syntax.
// This creates/updates 6 candidate edge(s), not AI-approved evidence.
UNWIND [
  {
    "from": "Type 2 Diabetes",
    "to": "Diabetes",
    "sourceRefs": [
      "[17]",
      "[23]"
    ],
    "evidenceNote": "Type 2 diabetes is a classified subtype of diabetes."
  },
  {
    "from": "Diabetic Ketoacidosis",
    "to": "Hyperglycemic Crisis",
    "sourceRefs": [
      "[23]",
      "[29]"
    ],
    "evidenceNote": "Diabetic ketoacidosis is a type of acute hyperglycaemic crisis."
  },
  {
    "from": "Diabetic Retinopathy",
    "to": "Microvascular Complication",
    "sourceRefs": [
      "[12]",
      "[28]"
    ],
    "evidenceNote": "Diabetic retinopathy is classified as a diabetes-related microvascular complication."
  },
  {
    "from": "Diabetic Neuropathy",
    "to": "Microvascular Complication",
    "sourceRefs": [
      "[12]",
      "[28]"
    ],
    "evidenceNote": "Diabetic neuropathy is classified among diabetes-related microvascular complications."
  },
  {
    "from": "Diabetic Nephropathy",
    "to": "Microvascular Complication",
    "sourceRefs": [
      "[12]",
      "[27]",
      "[28]"
    ],
    "evidenceNote": "Diabetic nephropathy is classified as a diabetes-related microvascular complication."
  },
  {
    "from": "Cardiovascular Disease",
    "to": "Macrovascular Complication",
    "sourceRefs": [
      "[4]",
      "[12]",
      "[17]"
    ],
    "evidenceNote": "Cardiovascular disease is represented as a macrovascular complication category in this simplified clinical ontology."
  }
 ] AS item
MATCH (a:MedicalConcept {name: item.from})
MATCH (b:MedicalConcept {name: item.to})
MERGE (a)-[r:IS_A]->(b)
SET r.sourceRefs = item.sourceRefs,
    r.evidenceNote = item.evidenceNote,
    r.evidenceType = 'literature',
    r.evidenceStatus = 'candidate_for_review',
    r.scope = 'Type 2 Diabetes',
    r.schemaVersion = 't2dm-medical-kg-v1'
RETURN count(r) AS relationshipsProcessed;
