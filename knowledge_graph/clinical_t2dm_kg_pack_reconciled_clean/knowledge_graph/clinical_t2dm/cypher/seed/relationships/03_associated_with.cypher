// One statement. Static relationship type ASSOCIATED_WITH; compatible without dynamic relationship-type syntax.
// This creates/updates 4 candidate edge(s), not AI-approved evidence.
UNWIND [
  {
    "from": "Obesity",
    "to": "Insulin Resistance",
    "sourceRefs": [
      "[2]",
      "[3]",
      "[11]"
    ],
    "evidenceNote": "Reviews describe mechanisms linking excess adiposity and altered adipose tissue function with insulin resistance."
  },
  {
    "from": "Type 2 Diabetes",
    "to": "Microvascular Complication",
    "sourceRefs": [
      "[12]",
      "[17]",
      "[28]"
    ],
    "evidenceNote": "Type 2 diabetes is associated with microvascular complications; this general association does not imply an individual patient has a complication."
  },
  {
    "from": "Type 2 Diabetes",
    "to": "Macrovascular Complication",
    "sourceRefs": [
      "[4]",
      "[12]",
      "[17]"
    ],
    "evidenceNote": "Type 2 diabetes is associated with macrovascular complications at a population/clinical level."
  },
  {
    "from": "Type 2 Diabetes",
    "to": "Chronic Kidney Disease",
    "sourceRefs": [
      "[12]",
      "[17]",
      "[27]"
    ],
    "evidenceNote": "Chronic kidney disease is an important diabetes-associated condition and a focus of guideline-directed risk management."
  }
 ] AS item
MATCH (a:MedicalConcept {name: item.from})
MATCH (b:MedicalConcept {name: item.to})
MERGE (a)-[r:ASSOCIATED_WITH]->(b)
SET r.sourceRefs = item.sourceRefs,
    r.evidenceNote = item.evidenceNote,
    r.evidenceType = 'literature',
    r.evidenceStatus = 'candidate_for_review',
    r.scope = 'Type 2 Diabetes',
    r.schemaVersion = 't2dm-medical-kg-v1'
RETURN count(r) AS relationshipsProcessed;
