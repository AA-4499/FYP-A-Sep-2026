"""ShanghaiT2DM Dataset Ingestion & Feature Extraction Loader.
Loads raw Excel patient summary files and 14-day continuous glucose monitoring (CGM) sensor sheets.
Swinburne University of Technology Sarawak · Ts. Dr. Vong Wan Tze
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = DATA_DIR / "raw"
SUMMARY_FILE = RAW_DIR / "Shanghai_T2DM_Summary.xlsx"
CGM_DIR = RAW_DIR / "Shanghai_T2DM"


def load_patient_summaries() -> pd.DataFrame:
    """Load the summary table of ShanghaiT2DM patient baseline characteristics."""
    if not SUMMARY_FILE.exists():
        cleaned_file = RAW_DIR / "cleaned_Shanghai_T2DM_Summary.xlsx"
        if cleaned_file.exists():
            return pd.read_excel(cleaned_file)
        raise FileNotFoundError(f"ShanghaiT2DM summary file not found at {SUMMARY_FILE}")
    return pd.read_excel(SUMMARY_FILE)


def load_cgm_readings(patient_id: str) -> Optional[pd.DataFrame]:
    """Load continuous glucose monitoring sensor readings for a specific patient.
    
    Raw CGM files follow the naming pattern: <patient_id>_<visit>_<date>.xls
    """
    if not CGM_DIR.exists():
        return None

    # Search for files matching the patient ID prefix
    pattern = f"{patient_id}_*.xls"
    matching_files = list(CGM_DIR.glob(pattern))
    if not matching_files:
        return None

    # Load and concatenate visits if multiple exist
    dfs = []
    for f in matching_files:
        try:
            df = pd.read_excel(f)
            df["source_file"] = f.name
            dfs.append(df)
        except Exception as exc:
            print(f"Warning: Failed to read {f}: {exc}")

    return pd.concat(dfs, ignore_index=True) if dfs else None


def compute_cgm_metrics(cgm_df: pd.DataFrame, glucose_col: str = "Glucose") -> Dict[str, float]:
    """Compute consensus continuous glucose monitoring (CGM) clinical metrics:
    - Mean Glucose (mmol/L)
    - Time-in-Range (TIR %): between 3.9 and 10.0 mmol/L (Goal: > 70%)
    - Time-Below-Range (TBR %): < 3.9 mmol/L (Safety goal: < 4%)
    - Time-Above-Range (TAR %): > 10.0 mmol/L (Goal: < 25%)
    - Glucose Management Indicator (GMI est. HbA1c %)
    """
    if glucose_col not in cgm_df.columns:
        # Fallback to first numeric column
        numeric_cols = cgm_df.select_dtypes(include=["number"]).columns
        if len(numeric_cols) > 0:
            glucose_col = numeric_cols[0]
        else:
            return {}

    values = pd.to_numeric(cgm_df[glucose_col], errors="coerce").dropna()
    if len(values) == 0:
        return {}

    mean_val = float(values.mean())
    tir = float((values.between(3.9, 10.0)).mean() * 100)
    tbr = float((values < 3.9).mean() * 100)
    tar = float((values > 10.0).mean() * 100)
    # GMI formula: 3.31 + 0.02392 * (mean in mg/dL, where 1 mmol/L = 18.0182 mg/dL)
    mean_mg_dl = mean_val * 18.0182
    gmi = float(3.31 + (0.02392 * mean_mg_dl))

    return {
        "mean_glucose": round(mean_val, 2),
        "time_in_range_pct": round(tir, 1),
        "time_below_range_pct": round(tbr, 1),
        "time_above_range_pct": round(tar, 1),
        "glucose_management_indicator": round(gmi, 1),
        "readings_count": len(values),
    }


if __name__ == "__main__":
    print(f"Testing Shanghai Loader from {RAW_DIR}...")
    try:
        df_summary = load_patient_summaries()
        print(f"Loaded {len(df_summary)} patient summary records.")
        print(f"Summary columns: {list(df_summary.columns[:8])}...")
    except Exception as e:
        print(f"Summary load note: {e}")
