"""Seed Neo4j database from ShanghaiT2DM patient records.
Team Member Assignment: Personal Health Knowledge Graph.
Swinburne University of Technology Sarawak · Ts. Dr. Vong Wan Tze
"""
from __future__ import annotations

import os
from typing import Any, Dict, List

# To execute with a live Neo4j database, configure environment variables:
# NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
# NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
# NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

def seed_patient_to_neo4j(patient_data: Dict[str, Any], driver=None) -> None:
    """Insert or update a patient node and connect biomarker and medication relationships in Neo4j."""
    query = """
    MERGE (p:Patient {id: $id})
    SET p.name = $name,
        p.age = $age,
        p.gender = $gender,
        p.bmi = $bmi,
        p.hba1c = $hba1c,
        p.fasting_glucose = $fbg,
        p.systolic_bp = $sys_bp,
        p.risk_category = $risk_category
    
    WITH p
    MERGE (b1:Biomarker {id: 'hba1c_' + p.id})
    SET b1.type = 'HbA1c', b1.value = $hba1c, b1.unit = '%'
    MERGE (p)-[:HAS_READING]->(b1)
    
    WITH p
    MERGE (b2:Biomarker {id: 'fbg_' + p.id})
    SET b2.type = 'FastingGlucose', b2.value = $fbg, b2.unit = 'mmol/L'
    MERGE (p)-[:HAS_READING]->(b2)
    
    WITH p
    MERGE (r:RiskFactor {id: 'risk_' + p.id})
    SET r.category = $risk_category
    MERGE (p)-[:EXHIBITS_RISK]->(r)
    """
    params = {
        "id": str(patient_data.get("id")),
        "name": patient_data.get("name"),
        "age": patient_data.get("age"),
        "gender": patient_data.get("gender"),
        "bmi": patient_data.get("bmi"),
        "hba1c": patient_data.get("hba1c"),
        "fbg": patient_data.get("fasting_glucose"),
        "sys_bp": patient_data.get("systolic_bp"),
        "risk_category": patient_data.get("risk_category", "Moderate Risk"),
    }
    
    if driver is not None:
        with driver.session() as session:
            session.run(query, **params)
            print(f"Seeded patient #{patient_data.get('id')} to Neo4j.")
    else:
        print(f"[Offline Simulation] Simulated Neo4j query for Patient #{patient_data.get('id')}.")


if __name__ == "__main__":
    sample = {
        "id": "1001",
        "name": "Patient #1001",
        "age": 62,
        "gender": "Female",
        "bmi": 26.4,
        "hba1c": 7.4,
        "fasting_glucose": 7.8,
        "systolic_bp": 138,
        "risk_category": "Moderate Risk",
    }
    seed_patient_to_neo4j(sample)
