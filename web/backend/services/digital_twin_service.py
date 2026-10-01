"""Module 7: Digital Twin State Service.
Constructs physiological digital twin representations and organ-level health mappings.
Team Member Assignment: Digital Twin Physiological Modeling & 3D Visualization.
"""
from __future__ import annotations

from typing import Any, Dict, Optional
from .patient_service import get_patient
from .longitudinal_service import get_patient_timeline
from .risk_model_service import assess_patient_risk

# Teammate Hook: If your team develops custom SMPL 3D mesh morphing or differential equation twin simulations,
# integrate your simulator pipeline here.


def get_digital_twin_state(patient_id: str, custom_features: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Generate multi-organ digital twin representation comparing current state to baseline."""
    patient = get_patient(patient_id) or {}
    timeline = get_patient_timeline(patient_id)
    cgm_summary = timeline.get("summary", {})
    risk_info = assess_patient_risk(patient_id, custom_features=custom_features)

    # Resolve features
    hba1c = float(custom_features.get("hba1c", patient.get("hba1c", 7.4)) if custom_features else patient.get("hba1c", 7.4))
    fbg = float(custom_features.get("fasting_glucose", patient.get("fasting_glucose", 7.8)) if custom_features else patient.get("fasting_glucose", 7.8))
    tir = float(custom_features.get("time_in_range_pct", cgm_summary.get("time_in_range_pct", 70.0)) if custom_features else cgm_summary.get("time_in_range_pct", 70.0))
    sys_bp = float(custom_features.get("systolic_bp", patient.get("systolic_bp", 135)) if custom_features else patient.get("systolic_bp", 135))
    bmi = float(custom_features.get("bmi", patient.get("bmi", 26.5)) if custom_features else patient.get("bmi", 26.5))
    egfr = float(custom_features.get("egfr", patient.get("egfr", 85.0)) if custom_features else patient.get("egfr", 85.0))

    # Organ Health Metrics (0 = healthy, 100 = severe stress)
    pancreas_stress = min(100, max(10, int(((hba1c - 5.5) / 4.5) * 60 + ((100 - tir) / 60) * 40)))
    heart_stress = min(100, max(10, int(((sys_bp - 115) / 50) * 60 + ((bmi - 22) / 15) * 40)))
    kidney_stress = min(100, max(10, int(((100 - egfr) / 50) * 70 + ((sys_bp - 120) / 40) * 30)))
    liver_stress = min(100, max(10, int(((bmi - 21) / 15) * 70 + ((fbg - 5.5) / 5.0) * 30)))

    # Avatar color coding
    comp_score = risk_info["composite_risk_score"]
    if comp_score >= 0.70:
        twin_status = "High Physiological Strain"
        avatar_glow = "rgba(239, 68, 68, 0.4)"
        avatar_status_color = "#ef4444"
    elif comp_score >= 0.40:
        twin_status = "Moderate Metabolic Load"
        avatar_glow = "rgba(245, 158, 11, 0.3)"
        avatar_status_color = "#f59e0b"
    else:
        twin_status = "Optimal Metabolic Equilibrium"
        avatar_glow = "rgba(16, 185, 129, 0.3)"
        avatar_status_color = "#10b981"

    return {
        "patient_id": str(patient_id),
        "twin_status": twin_status,
        "avatar_glow": avatar_glow,
        "avatar_status_color": avatar_status_color,
        "composite_risk": risk_info["composite_risk_pct"],
        "organs": {
            "pancreas": {
                "name": "Endocrine Pancreas",
                "stress_score": pancreas_stress,
                "status": "High Strain" if pancreas_stress > 65 else "Moderate Strain" if pancreas_stress > 35 else "Nominal",
                "color": "#ef4444" if pancreas_stress > 65 else "#f59e0b" if pancreas_stress > 35 else "#10b981",
                "details": f"Beta-cell stress elevated due to HbA1c of {hba1c:.1f}% and CGM TIR of {tir:.1f}%.",
            },
            "cardiovascular": {
                "name": "Cardiovascular System",
                "stress_score": heart_stress,
                "status": "High Strain" if heart_stress > 65 else "Moderate Strain" if heart_stress > 35 else "Nominal",
                "color": "#ef4444" if heart_stress > 65 else "#f59e0b" if heart_stress > 35 else "#10b981",
                "details": f"Arterial pressure load at {int(sys_bp)} mmHg systolic.",
            },
            "kidneys": {
                "name": "Renal System",
                "stress_score": kidney_stress,
                "status": "High Strain" if kidney_stress > 65 else "Moderate Strain" if kidney_stress > 35 else "Nominal",
                "color": "#ef4444" if kidney_stress > 65 else "#f59e0b" if kidney_stress > 35 else "#10b981",
                "details": f"Filtration performance eGFR at {egfr:.1f} mL/min.",
            },
            "liver": {
                "name": "Hepatic Metabolic Hub",
                "stress_score": liver_stress,
                "status": "High Strain" if liver_stress > 65 else "Moderate Strain" if liver_stress > 35 else "Nominal",
                "color": "#ef4444" if liver_stress > 65 else "#f59e0b" if liver_stress > 35 else "#10b981",
                "details": f"Gluconeogenesis & lipid burden corresponding to BMI {bmi:.1f} kg/m².",
            },
        },
        "morphometry": {
            "height_cm": 168.0,
            "weight_kg": round(bmi * ((168.0 / 100.0) ** 2), 1),
            "bmi": bmi,
            "body_fat_est_pct": round(bmi * 1.2 + (0.23 * patient.get("age", 55)) - 10.8, 1),
        },
    }
