"""Standalone, reproducible model trainer for deployment environments.

Generates artifacts_notebook/diabetes_risk_random_forest.joblib from the tracked
BRFSS 2015 dataset if the trained model file does not already exist.
Used by Render / cloud build hooks so the private model is built on-demand
without needing large binary weights committed to Git.
"""
from __future__ import annotations

import sys
from pathlib import Path
from time import perf_counter

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import StratifiedGroupKFold

RANDOM_STATE = 42
PROJECT_DIR = Path(__file__).resolve().parent
DATA_PATH = PROJECT_DIR / "diabetes_012_health_indicators_BRFSS2015.csv"
ARTIFACTS_DIR = PROJECT_DIR / "artifacts_notebook"
MODEL_PATH = ARTIFACTS_DIR / "diabetes_risk_random_forest.joblib"
TARGET = "Diabetes_012"
FEATURES = [
    "HighBP", "HighChol", "CholCheck", "BMI", "Smoker", "Stroke",
    "HeartDiseaseorAttack", "PhysActivity", "Fruits", "Veggies",
    "HvyAlcoholConsump", "AnyHealthcare", "NoDocbcCost", "GenHlth",
    "MentHlth", "PhysHlth", "DiffWalk", "Sex", "Age", "Education", "Income",
]
EXPECTED_CLASSES = np.array([0, 1, 2])


def train_if_missing(force: bool = False) -> Path:
    """Train and persist the Random Forest model if absent or forced."""
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    if MODEL_PATH.exists() and not force:
        print(f"[OK] Model already exists at: {MODEL_PATH}")
        return MODEL_PATH

    if not DATA_PATH.exists():
        raise FileNotFoundError(f"BRFSS dataset not found at: {DATA_PATH}")

    print(f"Training diabetes risk Random Forest model from {DATA_PATH.name}...")
    start_time = perf_counter()

    source_df = pd.read_csv(DATA_PATH)
    missing = set(FEATURES + [TARGET]) - set(source_df.columns)
    if missing:
        raise ValueError(f"Missing required columns in dataset: {sorted(missing)}")

    df = source_df[FEATURES + [TARGET]].copy()
    df[FEATURES + [TARGET]] = df[FEATURES + [TARGET]].apply(pd.to_numeric, errors="coerce")
    df = df.dropna(subset=FEATURES + [TARGET]).copy()
    df[TARGET] = df[TARGET].astype(int)
    df = df[df[TARGET].isin(EXPECTED_CLASSES)].copy()

    X = df[FEATURES].astype(float)
    y = df[TARGET].astype(int)

    # StratifiedGroupKFold on hashed profile prevents duplicate survey rows from leaking
    profile_groups = pd.util.hash_pandas_object(X, index=False).to_numpy()
    splitter = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    overall_distribution = y.value_counts(normalize=True).reindex(EXPECTED_CLASSES, fill_value=0)

    def split_score(pair):
        _, test_position = pair
        test_distribution = y.iloc[test_position].value_counts(normalize=True).reindex(EXPECTED_CLASSES, fill_value=0)
        return abs(len(test_position) / len(y) - 0.20) + float((test_distribution - overall_distribution).abs().sum())

    train_position, _test_position = min(splitter.split(X, y, groups=profile_groups), key=split_score)
    X_train = X.iloc[train_position].copy()
    y_train = y.iloc[train_position].copy()

    model = RandomForestClassifier(
        n_estimators=400,
        class_weight="balanced_subsample",
        min_samples_leaf=2,
        n_jobs=-1,
        random_state=RANDOM_STATE,
    )
    model.fit(X_train, y_train)

    temp_path = MODEL_PATH.with_suffix(".tmp")
    joblib.dump(model, temp_path, compress=3)
    temp_path.replace(MODEL_PATH)

    elapsed = perf_counter() - start_time
    print(f"[OK] Trained and saved model to {MODEL_PATH} in {elapsed:.2f}s ({len(X_train):,} training rows).")
    return MODEL_PATH


if __name__ == "__main__":
    force_train = "--force" in sys.argv
    train_if_missing(force=force_train)
