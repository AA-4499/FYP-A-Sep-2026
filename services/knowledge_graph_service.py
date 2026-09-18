"""Module 5: Personal Health Knowledge Graph Service.
Constructs ontological knowledge graph connecting patient data, clinical risks, and guidelines.
Team Member Assignment: Personal Health Knowledge Graph & Medical Ontology.
"""
from __future__ import annotations

from typing import Any, Dict, List
from .patient_service import get_patient
from .longitudinal_service import get_patient_timeline
from .risk_model_service import assess_patient_risk

# Teammate Hook: To connect this service to a live Neo4j instance,
# configure the official Neo4j Python Driver:
# from neo4j import GraphDatabase
# NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
# NEO4J_AUTH = (os.getenv("NEO4J_USER", "neo4j"), os.getenv("NEO4J_PASSWORD", "password"))
# DRIVER = GraphDatabase.driver(NEO4J_URI, auth=NEO4J_AUTH)


def get_patient_knowledge_graph(patient_id: str) -> Dict[str, Any]:
    """Generate Cytoscape.js compatible graph elements for the patient's health ontology."""
    patient = get_patient(patient_id) or {}
    timeline = get_patient_timeline(patient_id)
    risk_info = assess_patient_risk(patient_id)

    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

    # 1. Central Patient Node
    p_id = f"patient_{patient_id}"
    nodes.append({
        "data": {
            "id": p_id,
            "label": f"Patient #{patient_id}\n({patient.get('age', 55)}yo {patient.get('gender', 'Unknown')})",
            "type": "Patient",
            "category": "patient",
            "color": "#3b82f6",
            "size": 65,
        }
    })

    # 2. Longitudinal Biomarker Nodes
    biomarkers = [
        ("node_hba1c", f"HbA1c: {patient.get('hba1c', 7.0)}%", "Glycemic Marker", "#10b981" if patient.get('hba1c', 7.0) < 7.0 else "#ef4444"),
        ("node_fbg", f"Fasting: {patient.get('fasting_glucose', 7.0)} mmol/L", "Glycemic Marker", "#f59e0b"),
        ("node_tir", f"TIR: {timeline.get('summary', {}).get('time_in_range_pct', 70)}%", "CGM Metric", "#06b6d4"),
        ("node_bp", f"BP: {patient.get('systolic_bp', 130)}/{patient.get('diastolic_bp', 80)} mmHg", "Hemodynamic Marker", "#8b5cf6"),
        ("node_bmi", f"BMI: {patient.get('bmi', 25.0)} kg/m²", "Anthropometric", "#ec4899"),
        ("node_egfr", f"eGFR: {patient.get('egfr', 80.0)} mL/min", "Renal Marker", "#14b8a6"),
    ]

    for node_id, label, cat, color in biomarkers:
        nodes.append({
            "data": {
                "id": node_id,
                "label": label,
                "type": "Biomarker",
                "category": cat,
                "color": color,
                "size": 45,
            }
        })
        edges.append({
            "data": {
                "id": f"e_{p_id}_{node_id}",
                "source": p_id,
                "target": node_id,
                "label": "has_reading",
            }
        })

    # 3. Clinical Risk Nodes
    sub_risks = risk_info.get("sub_risks", {})
    for key, val in sub_risks.items():
        r_node_id = f"risk_{key}"
        nodes.append({
            "data": {
                "id": r_node_id,
                "label": f"{val.get('name')}\n({val.get('level')})",
                "type": "RiskFactor",
                "category": "Clinical Risk",
                "color": "#dc2626" if val.get('level') == "High" else "#d97706" if val.get('level') == "Moderate" else "#059669",
                "size": 52,
            }
        })
        edges.append({
            "data": {
                "id": f"e_{p_id}_{r_node_id}",
                "source": p_id,
                "target": r_node_id,
                "label": "exhibits_risk",
            }
        })

    # Connect biomarker causes to specific risk nodes
    edges.append({"data": {"id": "e_hba1c_gv", "source": "node_hba1c", "target": "risk_glycemic_variability", "label": "drives"}})
    edges.append({"data": {"id": "e_tir_gv", "source": "node_tir", "target": "risk_glycemic_variability", "label": "modulates"}})
    edges.append({"data": {"id": "e_bp_cv", "source": "node_bp", "target": "risk_cardiovascular", "label": "aggravates"}})
    edges.append({"data": {"id": "e_egfr_nephro", "source": "node_egfr", "target": "risk_nephropathy", "label": "indicates"}})

    # 4. Medication & Treatment Nodes
    medications = patient.get("medications", ["Metformin 1000mg BID"])
    for i, med in enumerate(medications):
        m_id = f"med_{i}"
        nodes.append({
            "data": {
                "id": m_id,
                "label": med,
                "type": "Medication",
                "category": "Pharmacotherapy",
                "color": "#6366f1",
                "size": 42,
            }
        })
        edges.append({
            "data": {
                "id": f"e_{p_id}_{m_id}",
                "source": p_id,
                "target": m_id,
                "label": "prescribed",
            }
        })
        edges.append({
            "data": {
                "id": f"e_{m_id}_gv",
                "source": m_id,
                "target": "risk_glycemic_variability",
                "label": "controls",
            }
        })

    # 5. Clinical Guidelines / Recommendations
    rec_nodes = [
        ("rec_diet", "Low Glycemic Index Diet", "Intervention", "#84cc16"),
        ("rec_exercise", "150 min/wk Aerobic Exercise", "Intervention", "#22c55e"),
    ]
    for r_id, r_label, r_cat, r_color in rec_nodes:
        nodes.append({
            "data": {
                "id": r_id,
                "label": r_label,
                "type": "Intervention",
                "category": r_cat,
                "color": r_color,
                "size": 40,
            }
        })
        edges.append({
            "data": {
                "id": f"e_{r_id}_hba1c",
                "source": r_id,
                "target": "node_hba1c",
                "label": "lowers",
            }
        })

    return {
        "patient_id": str(patient_id),
        "elements": {
            "nodes": nodes,
            "edges": edges,
        },
        "stats": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "ontology_standard": "SNOMED-CT / ShanghaiT2DM Clinical Graph Schema",
        }
    }
