"""Module 9: Consolidated Patient Health Reporting Service.
Aggregates all clinical modules into a comprehensive clinical summary report.
Team Member Assignment: Clinical Reporting & Decision Support.
"""
from __future__ import annotations

from typing import Any, Dict
from datetime import datetime
from .patient_service import get_patient
from .longitudinal_service import get_patient_timeline
from .risk_model_service import assess_patient_risk
from .xai_service import explain_patient_risk
from .insights_service import generate_patient_insights
from .digital_twin_service import get_digital_twin_state

# Teammate Hook: If implementing PDF generation (e.g. ReportLab, WeasyPrint) or FHIR bundle export,
# implement export helpers here.


def generate_patient_report(patient_id: str) -> Dict[str, Any]:
    """Compile comprehensive clinical summary report for patient review and printing."""
    patient = get_patient(patient_id)
    if not patient:
        return {"error": f"Patient #{patient_id} not found."}

    timeline = get_patient_timeline(patient_id)
    risk = assess_patient_risk(patient_id)
    xai = explain_patient_risk(patient_id)
    insights = generate_patient_insights(patient_id)
    twin = get_digital_twin_state(patient_id)

    report_id = f"RPT-SH-{patient_id}-{datetime.now().strftime('%Y%m%d%H%M')}"

    return {
        "report_id": report_id,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "institution": "Swinburne University of Technology Sarawak - Smart Health Platform",
        "supervision": "Ts. Dr. Vong Wan Tze",
        "patient_profile": patient,
        "longitudinal_summary": timeline.get("summary", {}),
        "risk_evaluation": {
            "composite_risk_pct": risk.get("composite_risk_pct"),
            "risk_category": risk.get("risk_category"),
            "sub_risks": risk.get("sub_risks"),
        },
        "explainable_ai": {
            "summary": xai.get("explanation_summary"),
            "top_factors": xai.get("contributions", [])[:5],
        },
        "digital_twin": {
            "status": twin.get("twin_status"),
            "organs": twin.get("organs"),
        },
        "clinical_insights": {
            "alert_level": insights.get("alert_level"),
            "recommendations": insights.get("recommendations"),
        },
        "clinical_sign_off": {
            "status": "System Verified",
            "notes": "Generated automatically from longitudinal ShanghaiT2DM data and multi-organ digital twin simulation.",
        },
    }
