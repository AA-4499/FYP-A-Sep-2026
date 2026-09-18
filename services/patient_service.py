"""Module 1: Patient Management Service.
Responsible for managing ShanghaiT2DM patient profiles and records.
Team Member Assignment: Patient Management & Data Ingestion.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
import math

# Realistic ShanghaiT2DM base patient dataset profiles (IDs 1001 to 1105)
# Teammate Hook: Replace or extend this dictionary by parsing the raw ShanghaiT2DM Excel/CSV files.
BASE_PATIENTS: Dict[str, Dict[str, Any]] = {
    "1001": {
        "id": "1001",
        "name": "Patient #1001",
        "age": 62,
        "gender": "Female",
        "bmi": 26.4,
        "diabetes_duration_years": 8.5,
        "hypertension": 1,
        "smoking": 0,
        "phys_activity_level": "Moderate",
        "fasting_glucose": 7.8,
        "hba1c": 7.4,
        "systolic_bp": 138,
        "diastolic_bp": 84,
        "ldl_cholesterol": 3.1,
        "hdl_cholesterol": 1.2,
        "triglycerides": 2.1,
        "egfr": 78.5,
        "medications": ["Metformin 1000mg BID", "Gliclazide 60mg QD"],
        "cgm_days_recorded": 14,
        "risk_category": "Moderate Risk",
    },
    "1002": {
        "id": "1002",
        "name": "Patient #1002",
        "age": 54,
        "gender": "Male",
        "bmi": 29.8,
        "diabetes_duration_years": 4.0,
        "hypertension": 1,
        "smoking": 1,
        "phys_activity_level": "Sedentary",
        "fasting_glucose": 9.4,
        "hba1c": 8.6,
        "systolic_bp": 146,
        "diastolic_bp": 90,
        "ldl_cholesterol": 3.8,
        "hdl_cholesterol": 0.95,
        "triglycerides": 2.9,
        "egfr": 82.0,
        "medications": ["Metformin 1000mg BID", "Empagliflozin 10mg QD", "Atorvastatin 20mg QN"],
        "cgm_days_recorded": 14,
        "risk_category": "High Risk",
    },
    "1003": {
        "id": "1003",
        "name": "Patient #1003",
        "age": 48,
        "gender": "Female",
        "bmi": 22.8,
        "diabetes_duration_years": 2.0,
        "hypertension": 0,
        "smoking": 0,
        "phys_activity_level": "Active",
        "fasting_glucose": 6.1,
        "hba1c": 6.3,
        "systolic_bp": 118,
        "diastolic_bp": 74,
        "ldl_cholesterol": 2.4,
        "hdl_cholesterol": 1.5,
        "triglycerides": 1.3,
        "egfr": 98.2,
        "medications": ["Metformin 500mg BID"],
        "cgm_days_recorded": 14,
        "risk_category": "Controlled / Low Risk",
    },
    "1004": {
        "id": "1004",
        "name": "Patient #1004",
        "age": 71,
        "gender": "Male",
        "bmi": 27.5,
        "diabetes_duration_years": 15.0,
        "hypertension": 1,
        "smoking": 0,
        "phys_activity_level": "Sedentary",
        "fasting_glucose": 8.7,
        "hba1c": 8.1,
        "systolic_bp": 142,
        "diastolic_bp": 82,
        "ldl_cholesterol": 3.2,
        "hdl_cholesterol": 1.1,
        "triglycerides": 2.4,
        "egfr": 61.4,
        "medications": ["Insulin Glargine 18U QN", "Metformin 850mg BID"],
        "cgm_days_recorded": 14,
        "risk_category": "High Risk",
    },
    "1005": {
        "id": "1005",
        "name": "Patient #1005",
        "age": 58,
        "gender": "Female",
        "bmi": 24.5,
        "diabetes_duration_years": 6.0,
        "hypertension": 0,
        "smoking": 0,
        "phys_activity_level": "Moderate",
        "fasting_glucose": 6.9,
        "hba1c": 6.9,
        "systolic_bp": 124,
        "diastolic_bp": 78,
        "ldl_cholesterol": 2.7,
        "hdl_cholesterol": 1.35,
        "triglycerides": 1.6,
        "egfr": 89.0,
        "medications": ["Metformin 500mg BID", "Sitagliptin 100mg QD"],
        "cgm_days_recorded": 14,
        "risk_category": "Moderate Risk",
    },
}

# Dynamically populate patients 1006 to 1105 to reflect the 100+ ShanghaiT2DM cohort
for idx in range(1006, 1106):
    sid = str(idx)
    age = 45 + ((idx * 7) % 35)
    gender = "Male" if idx % 2 == 0 else "Female"
    bmi = round(21.0 + ((idx * 3.7) % 12.5), 1)
    duration = round(1.0 + ((idx * 2.3) % 18.0), 1)
    hba1c = round(6.0 + ((idx * 1.9) % 4.2), 1)
    fbg = round(5.5 + ((idx * 2.1) % 6.0), 1)
    bp_sys = int(115 + ((idx * 5) % 40))
    bp_dia = int(72 + ((idx * 3) % 22))
    risk = "High Risk" if hba1c >= 8.0 or duration > 10 else "Moderate Risk" if hba1c >= 7.0 else "Controlled / Low Risk"
    
    BASE_PATIENTS[sid] = {
        "id": sid,
        "name": f"Patient #{sid}",
        "age": age,
        "gender": gender,
        "bmi": bmi,
        "diabetes_duration_years": duration,
        "hypertension": 1 if bp_sys >= 135 else 0,
        "smoking": 1 if idx % 4 == 0 else 0,
        "phys_activity_level": "Active" if idx % 3 == 0 else "Moderate" if idx % 3 == 1 else "Sedentary",
        "fasting_glucose": fbg,
        "hba1c": hba1c,
        "systolic_bp": bp_sys,
        "diastolic_bp": bp_dia,
        "ldl_cholesterol": round(2.0 + ((idx * 0.4) % 2.5), 1),
        "hdl_cholesterol": round(0.9 + ((idx * 0.2) % 0.8), 2),
        "triglycerides": round(1.1 + ((idx * 0.5) % 2.2), 1),
        "egfr": round(60.0 + ((idx * 4.1) % 45.0), 1),
        "medications": ["Metformin 1000mg BID"] if hba1c < 7.5 else ["Metformin 1000mg BID", "Insulin Glargine 14U QN"],
        "cgm_days_recorded": 14,
        "risk_category": risk,
    }


def list_patients(query: str = "", page: int = 1, per_page: int = 10) -> Dict[str, Any]:
    """Retrieve paginated patient list with optional search query filter."""
    patients = list(BASE_PATIENTS.values())
    if query:
        q = query.lower()
        patients = [p for p in patients if q in p["id"].lower() or q in p["name"].lower() or q in p["risk_category"].lower()]
    
    total = len(patients)
    start = max(0, (page - 1) * per_page)
    end = min(total, start + per_page)
    
    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": math.ceil(total / per_page) if total > 0 else 1,
        "patients": patients[start:end],
    }


def get_patient(patient_id: str) -> Optional[Dict[str, Any]]:
    """Fetch complete patient record by ShanghaiT2DM patient identifier."""
    return BASE_PATIENTS.get(str(patient_id))


def get_default_patient_id() -> str:
    """Return initial default patient ID."""
    return "1001"
