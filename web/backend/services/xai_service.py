"""Module 4: Risk Factor Attribution Service.

Returns heuristic linear factor attributions for the composite risk score.

This is NOT SHAP. The values are fixed linear coefficients multiplied by the
distance from a threshold, chosen by hand. They are not Shapley values, they
were not produced by an explainer, and they do not sum to the prediction minus
a baseline. Any consumer that needs real attributions must load a trained model
and a `shap.TreeExplainer` (see digital_twin/biophysical_models/stage3.py for an
existing example of the real thing).
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from .patient_service import get_patient
from .longitudinal_service import get_patient_timeline
from .risk_model_service import assess_patient_risk

# Teammate Hook: to make these real attributions, train a model, then:
# import shap
# EXPLAINER = shap.TreeExplainer(LOADED_MODEL)
# and return EXPLAINER(features_vector).values instead of the coefficients below.


def explain_patient_risk(patient_id: str, custom_features: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Return heuristic linear factor attributions (not SHAP) for a patient's risk."""
    patient = get_patient(patient_id) or {}
    timeline = get_patient_timeline(patient_id)
    cgm_summary = timeline.get("summary", {})
    risk_assessment = assess_patient_risk(patient_id, custom_features=custom_features)

    # Active clinical parameters
    hba1c = float(custom_features.get("hba1c", patient.get("hba1c", 7.4)) if custom_features else patient.get("hba1c", 7.4))
    fbg = float(custom_features.get("fasting_glucose", patient.get("fasting_glucose", 7.8)) if custom_features else patient.get("fasting_glucose", 7.8))
    tir = float(custom_features.get("time_in_range_pct", cgm_summary.get("time_in_range_pct", 70.0)) if custom_features else cgm_summary.get("time_in_range_pct", 70.0))
    tbr = float(custom_features.get("time_below_range_pct", cgm_summary.get("time_below_range_pct", 3.0)) if custom_features else cgm_summary.get("time_below_range_pct", 3.0))
    sys_bp = float(custom_features.get("systolic_bp", patient.get("systolic_bp", 135)) if custom_features else patient.get("systolic_bp", 135))
    bmi = float(custom_features.get("bmi", patient.get("bmi", 26.5)) if custom_features else patient.get("bmi", 26.5))
    duration = float(custom_features.get("diabetes_duration_years", patient.get("diabetes_duration_years", 6.0)) if custom_features else patient.get("diabetes_duration_years", 6.0))
    ldl = float(custom_features.get("ldl_cholesterol", patient.get("ldl_cholesterol", 2.9)) if custom_features else patient.get("ldl_cholesterol", 2.9))
    egfr = float(custom_features.get("egfr", patient.get("egfr", 85.0)) if custom_features else patient.get("egfr", 85.0))

    # Arbitrary reference constant used only to colour the chart. It is not a
    # learned base value and no additivity relation holds against it.
    base_expected_value = 0.380

    # Heuristic attributions: hand-set coefficients times distance from threshold.
    contributions: List[Dict[str, Any]] = []

    # 1. HbA1c
    hba1c_delta = round((hba1c - 7.0) * 0.085, 3)
    contributions.append({
        "feature": "hba1c",
        "label": "Glycated Hemoglobin (HbA1c)",
        "value": f"{hba1c:.1f} %",
        "attribution": hba1c_delta,
        "impact": "Increases Risk" if hba1c_delta > 0 else "Lowers Risk",
        "category": "Glycemic Control",
        "description": f"Target is <7.0%. Currently {hba1c:.1f}%, adding {abs(hba1c_delta)*100:.1f}% to risk." if hba1c_delta > 0 else f"Well controlled below threshold, reducing risk by {abs(hba1c_delta)*100:.1f}%."
    })

    # 2. Time in Range (TIR 3.9 - 10.0 mmol/L)
    tir_delta = round((70.0 - tir) * 0.0035, 3)
    contributions.append({
        "feature": "time_in_range_pct",
        "label": "CGM Time in Range (TIR)",
        "value": f"{tir:.1f} %",
        "attribution": tir_delta,
        "impact": "Increases Risk" if tir_delta > 0 else "Lowers Risk",
        "category": "CGM Monitoring",
        "description": f"International consensus target is >70% TIR. Patient achieved {tir:.1f}%."
    })

    # 3. Fasting Blood Glucose
    fbg_delta = round((fbg - 7.0) * 0.022, 3)
    contributions.append({
        "feature": "fasting_glucose",
        "label": "Fasting Blood Glucose",
        "value": f"{fbg:.1f} mmol/L",
        "attribution": fbg_delta,
        "impact": "Increases Risk" if fbg_delta > 0 else "Lowers Risk",
        "category": "Glycemic Control",
        "description": f"Normal fasting baseline is 4.4 - 7.0 mmol/L. Current reading: {fbg:.1f} mmol/L."
    })

    # 4. Systolic Blood Pressure
    bp_delta = round((sys_bp - 130.0) * 0.0028, 3)
    contributions.append({
        "feature": "systolic_bp",
        "label": "Systolic Blood Pressure",
        "value": f"{int(sys_bp)} mmHg",
        "attribution": bp_delta,
        "impact": "Increases Risk" if bp_delta > 0 else "Lowers Risk",
        "category": "Vascular Health",
        "description": f"Hypertensive threshold is >130 mmHg. Current: {int(sys_bp)} mmHg."
    })

    # 5. Diabetes Duration
    dur_delta = round((duration - 5.0) * 0.006, 3)
    contributions.append({
        "feature": "diabetes_duration_years",
        "label": "Diabetes Duration",
        "value": f"{duration:.1f} years",
        "attribution": dur_delta,
        "impact": "Increases Risk" if dur_delta > 0 else "Lowers Risk",
        "category": "History",
        "description": f"Longer chronicity increases cumulative microvascular exposure."
    })

    # 6. Body Mass Index (BMI)
    bmi_delta = round((bmi - 24.0) * 0.005, 3)
    contributions.append({
        "feature": "bmi",
        "label": "Body Mass Index (BMI)",
        "value": f"{bmi:.1f} kg/m²",
        "attribution": bmi_delta,
        "impact": "Increases Risk" if bmi_delta > 0 else "Lowers Risk",
        "category": "Metabolic Status",
        "description": f"Healthy weight range for Asian populations is 18.5 - 23.9 kg/m²."
    })

    # 7. LDL Cholesterol
    ldl_delta = round((ldl - 2.6) * 0.02, 3)
    contributions.append({
        "feature": "ldl_cholesterol",
        "label": "LDL Cholesterol",
        "value": f"{ldl:.1f} mmol/L",
        "attribution": ldl_delta,
        "impact": "Increases Risk" if ldl_delta > 0 else "Lowers Risk",
        "category": "Lipid Profile",
        "description": f"Optimal diabetic target is <2.6 mmol/L."
    })

    # 8. Renal Function (eGFR)
    egfr_delta = round((90.0 - egfr) * 0.002, 3)
    contributions.append({
        "feature": "egfr",
        "label": "Estimated GFR (eGFR)",
        "value": f"{egfr:.1f} mL/min",
        "attribution": egfr_delta,
        "impact": "Increases Risk" if egfr_delta > 0 else "Lowers Risk",
        "category": "Renal Function",
        "description": f"Normal filtration rate is >90 mL/min/1.73m²."
    })

    # Sort descending by absolute heuristic attribution magnitude
    contributions.sort(key=lambda x: abs(x["attribution"]), reverse=True)

    predicted_score = risk_assessment["composite_risk_score"]

    top_drivers = [c["label"] for c in contributions if c["attribution"] > 0][:3]
    top_protectors = [c["label"] for c in contributions if c["attribution"] < 0][:2]

    explanation_summary = (
        f"Patient #{patient_id}'s predicted diabetes complication risk is {risk_assessment['composite_risk_pct']}%. "
        f"The primary risk elevators are {', '.join(top_drivers) if top_drivers else 'None'}, "
        f"while {', '.join(top_protectors) if top_protectors else 'baseline stability'} provides protective dampening."
    )

    return {
        "patient_id": str(patient_id),
        "base_expected_value": base_expected_value,
        "predicted_risk_score": predicted_score,
        "explanation_summary": explanation_summary,
        "contributions": contributions,
        "methodology": "heuristic linear attribution (not SHAP)",
        "provenance": {
            "engine": "heuristic-linear-attribution-v1",
            "computed": False,
            "validated": False,
            "source": "synthetic",
            "shapley_additive": False,
            "note": (
                "Each `attribution` is a hand-set coefficient times the distance from a "
                "clinical threshold. These are not Shapley values: the sum of attributions "
                "plus base_expected_value does not equal predicted_risk_score."
            ),
        },
    }
