"""Module 8: What-If Scenario Simulation Service.
Runs counterfactual interventions (diet, exercise, medications) and predicts risk deltas.
Team Member Assignment: Counterfactual Simulation & What-If Engine.
"""
from __future__ import annotations

from typing import Any, Dict, Optional
from .patient_service import get_patient
from .longitudinal_service import get_patient_timeline
from .risk_model_service import assess_patient_risk
from .digital_twin_service import get_digital_twin_state

# Teammate Hook: If your team integrates causal ML (DoWhy, EconML) or biophysical simulation models,
# initialize your counterfactual simulator here.


def simulate_what_if(patient_id: str, scenario_deltas: Dict[str, Any]) -> Dict[str, Any]:
    """Simulate physiological and risk impacts of hypothetical interventions on a patient."""
    patient = get_patient(patient_id) or {}
    timeline = get_patient_timeline(patient_id)
    cgm_summary = timeline.get("summary", {})

    baseline_risk = assess_patient_risk(patient_id)
    baseline_twin = get_digital_twin_state(patient_id)

    # Base parameters
    cur_hba1c = float(patient.get("hba1c", 7.4))
    cur_fbg = float(patient.get("fasting_glucose", 7.8))
    cur_sys_bp = float(patient.get("systolic_bp", 135))
    cur_bmi = float(patient.get("bmi", 26.5))
    cur_tir = float(cgm_summary.get("time_in_range_pct", 70.0))
    cur_tbr = float(cgm_summary.get("time_below_range_pct", 3.0))

    # Apply scenario perturbations (preset interventions or slider offsets)
    # 1. Dietary intervention
    diet = scenario_deltas.get("diet_intervention", "none")
    diet_hba1c_eff = -0.6 if diet == "low_carb" else -0.4 if diet == "mediterranean" else 0.0
    diet_tir_eff = 10.0 if diet == "low_carb" else 7.0 if diet == "mediterranean" else 0.0

    # 2. Physical activity intervention
    exercise = scenario_deltas.get("exercise_intervention", "none")
    exercise_bp_eff = -6.0 if exercise == "regular_aerobic" else -3.0 if exercise == "light_walking" else 0.0
    exercise_bmi_eff = -1.2 if exercise == "regular_aerobic" else -0.5 if exercise == "light_walking" else 0.0

    # 3. Direct overrides or adjustments from UI sliders
    hba1c_slider = float(scenario_deltas.get("hba1c_change", 0.0))
    bmi_slider = float(scenario_deltas.get("bmi_change", 0.0))
    bp_slider = float(scenario_deltas.get("bp_change", 0.0))
    tir_slider = float(scenario_deltas.get("tir_change", 0.0))

    sim_hba1c = round(max(5.0, min(14.0, cur_hba1c + diet_hba1c_eff + hba1c_slider)), 1)
    sim_bmi = round(max(17.0, min(50.0, cur_bmi + exercise_bmi_eff + bmi_slider)), 1)
    sim_sys_bp = round(max(90.0, min(200.0, cur_sys_bp + exercise_bp_eff + bp_slider)), 0)
    sim_tir = round(max(20.0, min(98.0, cur_tir + diet_tir_eff + tir_slider)), 1)
    sim_fbg = round(max(4.0, min(18.0, cur_fbg - (cur_hba1c - sim_hba1c) * 1.1)), 1)

    sim_features = {
        "hba1c": sim_hba1c,
        "bmi": sim_bmi,
        "systolic_bp": sim_sys_bp,
        "time_in_range_pct": sim_tir,
        "fasting_glucose": sim_fbg,
        "time_below_range_pct": cur_tbr,
    }

    # Re-evaluate simulated state
    simulated_risk = assess_patient_risk(patient_id, custom_features=sim_features)
    simulated_twin = get_digital_twin_state(patient_id, custom_features=sim_features)

    # Risk differences
    risk_delta_abs = round(simulated_risk["composite_risk_score"] - baseline_risk["composite_risk_score"], 3)
    risk_delta_pct = round(risk_delta_abs * 100, 1)

    return {
        "patient_id": str(patient_id),
        "scenario_inputs": scenario_deltas,
        "baseline_comparison": {
            "hba1c": {"baseline": cur_hba1c, "simulated": sim_hba1c, "unit": "%"},
            "time_in_range": {"baseline": cur_tir, "simulated": sim_tir, "unit": "%"},
            "systolic_bp": {"baseline": int(cur_sys_bp), "simulated": int(sim_sys_bp), "unit": "mmHg"},
            "bmi": {"baseline": cur_bmi, "simulated": sim_bmi, "unit": "kg/m²"},
            "fasting_glucose": {"baseline": cur_fbg, "simulated": sim_fbg, "unit": "mmol/L"},
        },
        "risk_outcome": {
            "baseline_risk_pct": baseline_risk["composite_risk_pct"],
            "simulated_risk_pct": simulated_risk["composite_risk_pct"],
            "risk_delta_pct": risk_delta_pct,
            "baseline_category": baseline_risk["risk_category"],
            "simulated_category": simulated_risk["risk_category"],
            "status": "Improved" if risk_delta_pct < 0 else "Worsened" if risk_delta_pct > 0 else "Unchanged",
        },
        "organ_stress_comparison": {
            "pancreas": {
                "baseline": baseline_twin["organs"]["pancreas"]["stress_score"],
                "simulated": simulated_twin["organs"]["pancreas"]["stress_score"],
            },
            "cardiovascular": {
                "baseline": baseline_twin["organs"]["cardiovascular"]["stress_score"],
                "simulated": simulated_twin["organs"]["cardiovascular"]["stress_score"],
            },
            "kidneys": {
                "baseline": baseline_twin["organs"]["kidneys"]["stress_score"],
                "simulated": simulated_twin["organs"]["kidneys"]["stress_score"],
            },
            "liver": {
                "baseline": baseline_twin["organs"]["liver"]["stress_score"],
                "simulated": simulated_twin["organs"]["liver"]["stress_score"],
            },
        },
    }
