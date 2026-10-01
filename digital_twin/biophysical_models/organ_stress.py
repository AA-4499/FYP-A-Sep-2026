"""Biophysical models for organ-level metabolic stress calculation.
Mathematical representations for Pancreas, Cardiovascular, Renal, and Hepatic systems.
Swinburne University of Technology Sarawak · Ts. Dr. Vong Wan Tze
"""
from __future__ import annotations

from typing import Dict


def calculate_organ_stress(
    hba1c: float,
    fasting_glucose: float,
    systolic_bp: float,
    bmi: float,
    egfr: float,
    time_in_range_pct: float,
) -> Dict[str, Dict[str, object]]:
    """Compute biophysical organ stress indices (0 - 100)."""
    pancreas_stress = min(100, max(10, int(((hba1c - 5.5) / 4.5) * 60 + ((100 - time_in_range_pct) / 60) * 40)))
    heart_stress = min(100, max(10, int(((systolic_bp - 115) / 50) * 60 + ((bmi - 22) / 15) * 40)))
    kidney_stress = min(100, max(10, int(((100 - egfr) / 50) * 70 + ((systolic_bp - 120) / 40) * 30)))
    liver_stress = min(100, max(10, int(((bmi - 21) / 15) * 70 + ((fasting_glucose - 5.5) / 5.0) * 30)))

    return {
        "pancreas": {
            "stress_score": pancreas_stress,
            "status": "High Strain" if pancreas_stress > 65 else "Moderate Strain" if pancreas_stress > 35 else "Nominal",
        },
        "cardiovascular": {
            "stress_score": heart_stress,
            "status": "High Strain" if heart_stress > 65 else "Moderate Strain" if heart_stress > 35 else "Nominal",
        },
        "kidneys": {
            "stress_score": kidney_stress,
            "status": "High Strain" if kidney_stress > 65 else "Moderate Strain" if kidney_stress > 35 else "Nominal",
        },
        "liver": {
            "stress_score": liver_stress,
            "status": "High Strain" if liver_stress > 65 else "Moderate Strain" if liver_stress > 35 else "Nominal",
        },
    }
