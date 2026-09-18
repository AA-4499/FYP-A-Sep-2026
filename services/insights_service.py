"""Module 6: Longitudinal Trend Detection & Personalised Insights Service.
Analyzes longitudinal trends, CGM fluctuations, and synthesizes clinical recommendations.
Team Member Assignment: Trend Detection & Personalised Healthcare Insights.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from .patient_service import get_patient
from .longitudinal_service import get_patient_timeline
from .risk_model_service import assess_patient_risk

# Teammate Hook: If integrating LLM-assisted clinical insight generation (e.g., Gemini or Ollama),
# initialize your LLM chain or client here:
# from google import genai
# GENAI_CLIENT = genai.Client() if os.getenv("GEMINI_API_KEY") else None


def generate_patient_insights(patient_id: str, custom_features: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Analyze patient longitudinal trends and provide personalised actionable insights."""
    patient = get_patient(patient_id) or {}
    timeline = get_patient_timeline(patient_id)
    risk_data = assess_patient_risk(patient_id, custom_features=custom_features)

    cgm_summary = timeline.get("summary", {})
    tir = float(custom_features.get("time_in_range_pct", cgm_summary.get("time_in_range_pct", 70.0)) if custom_features else cgm_summary.get("time_in_range_pct", 70.0))
    tbr = float(custom_features.get("time_below_range_pct", cgm_summary.get("time_below_range_pct", 3.0)) if custom_features else cgm_summary.get("time_below_range_pct", 3.0))
    hba1c = float(custom_features.get("hba1c", patient.get("hba1c", 7.4)) if custom_features else patient.get("hba1c", 7.4))
    sys_bp = float(custom_features.get("systolic_bp", patient.get("systolic_bp", 135)) if custom_features else patient.get("systolic_bp", 135))
    bmi = float(custom_features.get("bmi", patient.get("bmi", 26.5)) if custom_features else patient.get("bmi", 26.5))

    # Alert level classification
    if tbr > 5.0 or hba1c >= 8.5 or sys_bp >= 150:
        alert_level = "urgent"
        alert_text = "Clinical Attention Advised: Substantial glycemic excursions or elevated blood pressure detected."
    elif tir < 65.0 or hba1c >= 7.5 or sys_bp >= 135:
        alert_level = "warning"
        alert_text = "Moderate Glycemic Disruption: Targets not met across several 14-day monitoring windows."
    else:
        alert_level = "normal"
        alert_text = "Stable Metabolic Profile: Key metrics remain within recommended therapeutic bounds."

    # Generate targeted clinical recommendations
    recommendations: List[Dict[str, Any]] = []

    # 1. Glycemic Recommendation
    if tir < 70.0:
        recommendations.append({
            "category": "Glycemic Management",
            "priority": "High",
            "title": "Optimize Post-Prandial Glycemic Excursions",
            "detail": f"Time in Range (TIR) is currently {tir:.1f}% (consensus goal >70%). Focus on reducing refined carbohydrates at lunch and dinner to curtail postprandial glucose peaks.",
            "target": "> 70% TIR",
        })
    else:
        recommendations.append({
            "category": "Glycemic Management",
            "priority": "Maintenance",
            "title": "Maintain High Glycemic Stability",
            "detail": f"Time in Range of {tir:.1f}% meets international targets. Continue current meal timing and medication regimen.",
            "target": "Sustain > 70% TIR",
        })

    # 2. Hypoglycemia Safety Check
    if tbr > 4.0:
        recommendations.append({
            "category": "Patient Safety",
            "priority": "Critical",
            "title": "Prevent Nocturnal Hypoglycemia",
            "detail": f"Time Below Range (<3.9 mmol/L) is elevated at {tbr:.1f}% (goal <4.0%). Consider adjusting bedtime basal insulin or sulfonylurea dosing to prevent nighttime hypoglycemia.",
            "target": "< 4% TBR",
        })

    # 3. Blood Pressure / Vascular Health
    if sys_bp >= 130:
        recommendations.append({
            "category": "Cardiovascular Protection",
            "priority": "High" if sys_bp >= 140 else "Medium",
            "title": "Blood Pressure Optimization",
            "detail": f"Systolic blood pressure is {int(sys_bp)} mmHg (recommended <130 mmHg). Implement dietary sodium reduction (<2g/day) and review ACEi/ARB therapy.",
            "target": "< 130/80 mmHg",
        })

    # 4. Lifestyle & Weight
    if bmi >= 25.0:
        recommendations.append({
            "category": "Lifestyle & Weight",
            "priority": "Medium",
            "title": "Structured Physical Activity & Weight Management",
            "detail": f"Current BMI is {bmi:.1f} kg/m². Achieving 5-7% weight reduction and 150 minutes of moderate aerobic exercise weekly will significantly improve insulin sensitivity.",
            "target": "5-7% weight reduction",
        })

    return {
        "patient_id": str(patient_id),
        "alert_level": alert_level,
        "alert_message": alert_text,
        "longitudinal_summary": (
            f"Over the 14-day continuous glucose monitoring evaluation, Patient #{patient_id} had an average glucose of "
            f"{cgm_summary.get('average_glucose', 7.5)} mmol/L with {tir:.1f}% Time in Range. Overall complication risk is {risk_data['risk_category']}."
        ),
        "recommendations": recommendations,
        "generated_by": "ShanghaiT2DM Personalized Clinical Rule Engine v2.0",
    }
