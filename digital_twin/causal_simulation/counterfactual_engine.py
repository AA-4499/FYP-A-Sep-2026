"""Counterfactual What-If Simulation Engine.
Estimates causal treatment and lifestyle intervention effects on physiological biomarkers.
Swinburne University of Technology Sarawak · Ts. Dr. Vong Wan Tze
"""
from __future__ import annotations

from typing import Any, Dict


def apply_counterfactual_intervention(
    baseline_features: Dict[str, float],
    diet: str = "none",
    exercise: str = "none",
    hba1c_delta: float = 0.0,
    bmi_delta: float = 0.0,
    bp_delta: float = 0.0,
    tir_delta: float = 0.0,
) -> Dict[str, float]:
    """Calculate simulated counterfactual state under hypothetical interventions."""
    cur_hba1c = baseline_features.get("hba1c", 7.4)
    cur_bmi = baseline_features.get("bmi", 26.5)
    cur_sys_bp = baseline_features.get("systolic_bp", 135.0)
    cur_tir = baseline_features.get("time_in_range_pct", 70.0)
    cur_fbg = baseline_features.get("fasting_glucose", 7.8)

    # Treatment effect sizes derived from meta-analyses & clinical trials
    diet_eff_hba1c = -0.6 if diet == "low_carb" else -0.4 if diet == "mediterranean" else 0.0
    diet_eff_tir = 10.0 if diet == "low_carb" else 7.0 if diet == "mediterranean" else 0.0

    exercise_eff_bp = -6.0 if exercise == "regular_aerobic" else -3.0 if exercise == "light_walking" else 0.0
    exercise_eff_bmi = -1.2 if exercise == "regular_aerobic" else -0.5 if exercise == "light_walking" else 0.0

    sim_hba1c = round(max(5.0, min(14.0, cur_hba1c + diet_eff_hba1c + hba1c_delta)), 1)
    sim_bmi = round(max(17.0, min(50.0, cur_bmi + exercise_eff_bmi + bmi_delta)), 1)
    sim_sys_bp = round(max(90.0, min(200.0, cur_sys_bp + exercise_eff_bp + bp_delta)), 0)
    sim_tir = round(max(20.0, min(98.0, cur_tir + diet_eff_tir + tir_delta)), 1)
    sim_fbg = round(max(4.0, min(18.0, cur_fbg - (cur_hba1c - sim_hba1c) * 1.1)), 1)

    return {
        "hba1c": sim_hba1c,
        "bmi": sim_bmi,
        "systolic_bp": sim_sys_bp,
        "time_in_range_pct": sim_tir,
        "fasting_glucose": sim_fbg,
    }
