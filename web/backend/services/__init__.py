"""Modular services for the Smart Diabetes Digital Twin and Personalised Health Management Platform.
Swinburne University of Technology Sarawak · Ts. Dr. Vong Wan Tze
"""
from .patient_service import list_patients, get_patient, get_default_patient_id
from .longitudinal_service import get_patient_timeline
from .risk_model_service import assess_patient_risk
from .xai_service import explain_patient_risk
from .knowledge_graph_service import get_patient_knowledge_graph
from .insights_service import generate_patient_insights
from .digital_twin_service import get_digital_twin_state
from .simulation_service import simulate_what_if
from .reporting_service import generate_patient_report

__all__ = [
    "list_patients",
    "get_patient",
    "get_default_patient_id",
    "get_patient_timeline",
    "assess_patient_risk",
    "explain_patient_risk",
    "get_patient_knowledge_graph",
    "generate_patient_insights",
    "get_digital_twin_state",
    "simulate_what_if",
    "generate_patient_report",
]
