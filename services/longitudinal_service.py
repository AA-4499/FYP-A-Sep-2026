"""Module 2: Longitudinal Health Monitoring Service.
Provides repeated CGM glucose readings and health indicator changes over time.
Team Member Assignment: Longitudinal Health Monitoring.
"""
from __future__ import annotations

from typing import Any, Dict, List
import math
from .patient_service import get_patient


def get_patient_timeline(patient_id: str) -> Dict[str, Any]:
    """Generate 14-day longitudinal continuous glucose monitoring (CGM) summary and historical visits."""
    patient = get_patient(patient_id)
    if not patient:
        patient = {"hba1c": 7.5, "fasting_glucose": 7.8, "age": 60}

    base_glucose = float(patient["fasting_glucose"])
    hba1c = float(patient["hba1c"])

    # 1. Generate 14-day daily aggregated summary
    daily_summaries: List[Dict[str, Any]] = []
    total_in_range_count = 0
    total_hypo_count = 0
    total_hyper_count = 0
    total_points = 0

    for day in range(1, 15):
        # Fluctuation based on baseline glucose and day variance
        day_shift = math.sin(day * 0.8) * 0.9
        mean_glucose = round(base_glucose + day_shift, 2)
        min_glucose = round(max(3.1, mean_glucose - (1.8 + (day % 3) * 0.4)), 2)
        max_glucose = round(mean_glucose + (2.5 + (day % 4) * 0.6), 2)

        # Time in range estimation (3.9 - 10.0 mmol/L)
        tir = round(max(35.0, min(95.0, 75.0 - (hba1c - 6.5) * 12 + math.cos(day) * 6)), 1)
        tbr = round(max(1.0, min(10.0, 3.5 - (hba1c - 7.0) * 1.5 + (1 if min_glucose < 3.9 else 0))), 1)
        tar = round(max(0.0, 100.0 - tir - tbr), 1)

        daily_summaries.append({
            "day": f"Day {day}",
            "day_number": day,
            "mean_glucose": mean_glucose,
            "min_glucose": min_glucose,
            "max_glucose": max_glucose,
            "time_in_range_pct": tir,
            "time_below_range_pct": tbr,
            "time_above_range_pct": tar,
        })

    # Overall 14-day CGM statistics
    avg_mean = round(sum(d["mean_glucose"] for d in daily_summaries) / len(daily_summaries), 2)
    avg_tir = round(sum(d["time_in_range_pct"] for d in daily_summaries) / len(daily_summaries), 1)
    avg_tbr = round(sum(d["time_below_range_pct"] for d in daily_summaries) / len(daily_summaries), 1)
    avg_tar = round(sum(d["time_above_range_pct"] for d in daily_summaries) / len(daily_summaries), 1)

    # 2. Hourly average diurnal glucose profile (24 hours: 00:00 - 23:00)
    hourly_profile: List[Dict[str, Any]] = []
    for hour in range(24):
        # Natural diurnal variation: post-breakfast (08:00), post-lunch (13:00), post-dinner (19:00), dawn effect (05:00)
        meal_peak = 0.0
        if 7 <= hour <= 9:
            meal_peak = 2.4 * math.sin((hour - 7) / 2 * math.pi)
        elif 12 <= hour <= 14:
            meal_peak = 2.8 * math.sin((hour - 12) / 2 * math.pi)
        elif 18 <= hour <= 21:
            meal_peak = 3.2 * math.sin((hour - 18) / 3 * math.pi)
        elif 4 <= hour <= 6:
            meal_peak = 0.8  # Dawn phenomenon

        simulated_val = round(base_glucose - 0.4 + meal_peak, 2)
        hourly_profile.append({
            "hour": f"{hour:02d}:00",
            "glucose": simulated_val,
            "target_low": 3.9,
            "target_high": 10.0,
        })

    # 3. Longitudinal Historical Visits (HbA1c & Blood Pressure over past 18 months)
    historical_visits: List[Dict[str, Any]] = [
        {
            "visit": "18 Mos Ago",
            "date": "2025-03-15",
            "hba1c": round(hba1c + 0.9, 1),
            "fasting_glucose": round(base_glucose + 1.2, 1),
            "systolic_bp": patient.get("systolic_bp", 130) + 6,
            "bmi": patient.get("bmi", 25.0) + 0.8,
        },
        {
            "visit": "12 Mos Ago",
            "date": "2025-09-10",
            "hba1c": round(hba1c + 0.4, 1),
            "fasting_glucose": round(base_glucose + 0.5, 1),
            "systolic_bp": patient.get("systolic_bp", 130) + 2,
            "bmi": patient.get("bmi", 25.0) + 0.3,
        },
        {
            "visit": "6 Mos Ago",
            "date": "2026-03-20",
            "hba1c": round(hba1c + 0.1, 1),
            "fasting_glucose": round(base_glucose + 0.2, 1),
            "systolic_bp": patient.get("systolic_bp", 130),
            "bmi": patient.get("bmi", 25.0),
        },
        {
            "visit": "Current Visit",
            "date": "2026-09-15",
            "hba1c": hba1c,
            "fasting_glucose": base_glucose,
            "systolic_bp": patient.get("systolic_bp", 130),
            "bmi": patient.get("bmi", 25.0),
        },
    ]

    return {
        "patient_id": str(patient_id),
        "summary": {
            "average_glucose": avg_mean,
            "time_in_range_pct": avg_tir,
            "time_below_range_pct": avg_tbr,
            "time_above_range_pct": avg_tar,
            "glucose_management_indicator": round(3.31 + (0.02392 * (avg_mean * 18.0)), 1),
            "days_recorded": 14,
        },
        "daily_trends": daily_summaries,
        "hourly_cgm_profile": hourly_profile,
        "historical_visits": historical_visits,
    }
