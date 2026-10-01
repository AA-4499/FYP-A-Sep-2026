// Neo4j Constraints and Indexes for ShanghaiT2DM Personal Health Knowledge Graph
CREATE CONSTRAINT patient_id_unique IF NOT EXISTS
FOR (p:Patient) REQUIRE p.id IS UNIQUE;

CREATE CONSTRAINT biomarker_id_unique IF NOT EXISTS
FOR (b:Biomarker) REQUIRE b.id IS UNIQUE;

CREATE CONSTRAINT risk_factor_id_unique IF NOT EXISTS
FOR (r:RiskFactor) REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT medication_id_unique IF NOT EXISTS
FOR (m:Medication) REQUIRE m.name IS UNIQUE;

CREATE INDEX patient_risk_idx IF NOT EXISTS
FOR (p:Patient) ON (p.risk_category);
