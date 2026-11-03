// Run after duplicate audit is clean and after cleanup; an equivalent existing uniqueness constraint should satisfy IF NOT EXISTS.
CREATE CONSTRAINT clinical_kg_concept_name_unique IF NOT EXISTS
FOR (c:MedicalConcept) REQUIRE c.name IS UNIQUE;
