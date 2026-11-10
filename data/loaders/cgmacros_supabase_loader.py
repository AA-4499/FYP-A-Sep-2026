#!/usr/bin/env python3
"""Validate and import the public CGMacros 1.0.0 dataset into Supabase.

Run from the repository root. Default mode is a dry run; add --load to write
complete, validated records to Supabase. The script uses a two-pass streaming
approach so it does not hold all participants' observations in memory.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import pandas as pd
import requests
from dotenv import load_dotenv
from supabase import create_client

SOURCE_URL = "https://physionet.org/files/cgmacros/1.0.0/CGMacros_dateshifted365.zip"
SOURCE_SHA256 = "05c8b0e6f1a2757050aced55ce4bf6ab2ac9b30f2fd8ca193056812d9c621d4d"
SOURCE_DOI = "10.13026/3z8q-x658"
SOURCE_VERSION = "1.0.0"
DEFAULT_ARCHIVE = Path("data/raw/CGMacros/CGMacros_dateshifted365.zip")
BATCH_SIZE = 500

REQUIRED_MAIN_COLUMNS = [
    "Timestamp", "Libre GL", "Dexcom GL", "HR", "Calories (Activity)",
    "Mets", "Meal Type", "Calories", "Carbs", "Protein", "Fat", "Fiber",
    "Amount Consumed",
]


def normalise_name(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value).strip().lower())


def find_column(frame: pd.DataFrame, candidates: list[str]) -> str | None:
    by_normalised = {normalise_name(col): col for col in frame.columns}
    for candidate in candidates:
        if normalise_name(candidate) in by_normalised:
            return by_normalised[normalise_name(candidate)]
    return None


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def download_archive(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_suffix(path.suffix + ".part")
    print(f"Downloading CGMacros 1.0.0 to {path} ...")
    with requests.get(SOURCE_URL, stream=True, timeout=(30, 180)) as response:
        response.raise_for_status()
        with partial.open("wb") as output:
            for block in response.iter_content(chunk_size=8 * 1024 * 1024):
                if block:
                    output.write(block)
    partial.replace(path)


def parse_participant_number(path_name: str) -> int | None:
    match = re.search(r"CGMacros-(\d{1,3})\.csv$", Path(path_name).name, re.I)
    return int(match.group(1)) if match else None


def exact_deduplicate(
    records: list[dict[str, Any]],
    key_fields: tuple[str, ...],
    value_fields: tuple[str, ...],
    label: str,
) -> tuple[list[dict[str, Any]], int]:
    """Drop identical duplicate keys; stop if the same key has conflicting data."""
    seen: dict[tuple[Any, ...], tuple[Any, ...]] = {}
    output: list[dict[str, Any]] = []
    duplicates = 0
    for record in records:
        key = tuple(record[field] for field in key_fields)
        values = tuple(record[field] for field in value_fields)
        if key in seen:
            if seen[key] != values:
                raise ValueError(
                    f"Conflicting duplicate {label} key {key}; review the source file."
                )
            duplicates += 1
            continue
        seen[key] = values
        output.append(record)
    return output, duplicates


def as_number(value: Any) -> float | None:
    parsed = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
    if pd.isna(parsed):
        return None
    return float(parsed)


def parse_bio_profiles(
    bio: pd.DataFrame, participant_numbers: list[int]
) -> list[dict[str, Any]]:
    """Map required participant profile fields to the matching participant IDs.

    The original publisher notebook maps bio.csv rows in order to sorted
    participant CSVs where an explicit participant identifier is absent.
    """
    required = {
        "age": find_column(bio, ["Age"]),
        "sex": find_column(bio, ["Gender"]),
        "bmi": find_column(bio, ["BMI"]),
        "hba1c": find_column(bio, ["A1c PDL (Lab)", "A1c"]),
    }
    missing_columns = [key for key, value in required.items() if value is None]
    if missing_columns:
        raise ValueError("bio.csv is missing required fields: " + ", ".join(missing_columns))

    id_col = find_column(
        bio, ["Participant ID", "Participant", "Subject ID", "Subject", "Patient ID"]
    )
    rows_by_number: dict[int, pd.Series] = {}

    if id_col:
        for _, row in bio.iterrows():
            match = re.search(r"(\d{1,3})", str(row[id_col]))
            if match:
                number = int(match.group(1))
                if number in rows_by_number:
                    raise ValueError(f"Duplicate participant {number} in bio.csv")
                rows_by_number[number] = row
        if not set(participant_numbers).issubset(rows_by_number):
            raise ValueError("bio.csv participant IDs do not match all main participant files.")
    else:
        if len(bio) != len(participant_numbers):
            raise ValueError(
                "bio.csv has no participant ID column and its row count differs from "
                "the main participant-file count. Refusing to guess the mapping."
            )
        print(
            "NOTE: bio.csv has no participant ID column; matching its rows in order "
            "to sorted main CSV participant IDs, as in the original publisher notebook."
        )
        rows_by_number = {
            number: bio.iloc[index] for index, number in enumerate(participant_numbers)
        }

    profiles: list[dict[str, Any]] = []
    for number in participant_numbers:
        row = rows_by_number[number]
        age = as_number(row[required["age"]])
        bmi = as_number(row[required["bmi"]])
        hba1c = as_number(row[required["hba1c"]])
        sex_value = str(row[required["sex"]]).strip().upper()
        if sex_value in {"MALE", "M"}:
            sex_value = "M"
        elif sex_value in {"FEMALE", "F"}:
            sex_value = "F"

        if age is None or bmi is None or hba1c is None or sex_value not in {"F", "M"}:
            raise ValueError(
                f"CGMacros-{number:03d} has a missing required profile value; no imputation."
            )
        if not (18 <= age <= 69 and 20.69 <= bmi <= 49.09 and 4.6 <= hba1c <= 8.5):
            raise ValueError(
                f"CGMacros-{number:03d} has a profile value outside the official data ranges."
            )

        # The Bio data dictionary labels the 4.6–8.5 A1c values as mmol/mol,
        # but the paper reports these as percentages and uses percentage
        # thresholds to define the 15/16/14 cohort groups. We follow the
        # paper's published classification logic; see the import documentation.
        if hba1c < 5.7:
            group = "No diabetes"
        elif hba1c <= 6.4:
            group = "Prediabetes"
        else:
            group = "Type 2 Diabetes"

        profiles.append({
            "participant_id": f"CGMacros-{number:03d}",
            "age_years": age,
            "sex": sex_value,
            "bmi": bmi,
            "hba1c_percent": hba1c,
            "diabetes_group": group,
            "source_dataset": "CGMacros",
            "source_version": SOURCE_VERSION,
            "source_doi": SOURCE_DOI,
        })
    return profiles


def build_measurement_records(
    frame: pd.DataFrame, participant_id: str, source_file: str
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], dict[str, int]]:
    """Create non-empty, valid glucose, Fitbit activity and meal records."""
    columns = {normalise_name(col): col for col in frame.columns}
    missing = [
        name for name in REQUIRED_MAIN_COLUMNS
        if normalise_name(name) not in columns
    ]
    if missing:
        raise ValueError(f"{source_file} is missing required columns: {missing}")

    def col(name: str) -> str:
        return columns[normalise_name(name)]

    parsed_time = pd.to_datetime(frame[col("Timestamp")], errors="coerce")
    glucose_records: list[dict[str, Any]] = []
    activity_records: list[dict[str, Any]] = []
    meal_records: list[dict[str, Any]] = []
    counts = {
        "glucose_rows_read": len(frame) * 2,
        "activity_rows_read": len(frame),
        "meal_rows_read": 0,
        "incomplete_rows_rejected": 0,
        "invalid_rows_rejected": int(parsed_time.isna().sum()),
        "duplicate_rows_rejected": 0,
    }

    for index, timestamp in enumerate(parsed_time):
        if pd.isna(timestamp):
            continue
        recorded_at = timestamp.strftime("%Y-%m-%dT%H:%M:%S")
        source_row = index + 2

        # Keep the two sensors as separate readings; do not average them.
        # Original sensor intervals: Libre 15 min, Dexcom 5 min. Published CSV
        # values are already linearly interpolated to a one-minute grid.
        for device, field, native_interval in (
            ("Abbott FreeStyle Libre Pro", "Libre GL", 15),
            ("Dexcom G6 Pro", "Dexcom GL", 5),
        ):
            value = as_number(frame.iloc[index][col(field)])
            if value is None:
                counts["incomplete_rows_rejected"] += 1
            elif not 40 <= value <= 400:
                counts["invalid_rows_rejected"] += 1
            else:
                glucose_records.append({
                    "participant_id": participant_id,
                    "recorded_at": recorded_at,
                    "cgm_device": device,
                    "glucose_mg_dl": value,
                    "native_sampling_interval_minutes": native_interval,
                    "published_series_interval_minutes": 1,
                    "linear_interpolation_in_source": True,
                    "source_file": source_file,
                    "source_row_number": source_row,
                })

        # Fitbit activity rows require all three measures. No partial record
        # is written into the model-ready activity table.
        hr = as_number(frame.iloc[index][col("HR")])
        calories = as_number(frame.iloc[index][col("Calories (Activity)")])
        mets_x10 = as_number(frame.iloc[index][col("Mets")])
        if hr is None or calories is None or mets_x10 is None:
            counts["incomplete_rows_rejected"] += 1
        elif not (30 <= hr <= 176 and 0 <= calories <= 16.178 and 10 <= mets_x10 <= 176):
            counts["invalid_rows_rejected"] += 1
        else:
            activity_records.append({
                "participant_id": participant_id,
                "recorded_at": recorded_at,
                "heart_rate_bpm": hr,
                "calories_activity_kcal": calories,
                "activity_met": round(mets_x10 / 10.0, 2),
                "source_mets_x10": mets_x10,
                "source_file": source_file,
                "source_row_number": source_row,
            })

        meal_value = frame.iloc[index][col("Meal Type")]
        if pd.notna(meal_value) and str(meal_value).strip():
            counts["meal_rows_read"] += 1
            meal_type = {
                "breakfast": "Breakfast",
                "lunch": "Lunch",
                "dinner": "Dinner",
            }.get(str(meal_value).strip().lower())
            values = {
                "meal_calories_kcal": as_number(frame.iloc[index][col("Calories")]),
                "carbohydrates_g": as_number(frame.iloc[index][col("Carbs")]),
                "protein_g": as_number(frame.iloc[index][col("Protein")]),
                "fat_g": as_number(frame.iloc[index][col("Fat")]),
                "fiber_g": as_number(frame.iloc[index][col("Fiber")]),
                "amount_consumed_percent": as_number(frame.iloc[index][col("Amount Consumed")]),
            }
            if meal_type is None or any(value is None for value in values.values()):
                counts["incomplete_rows_rejected"] += 1
            elif not (
                30 <= values["meal_calories_kcal"] <= 1180
                and 0 <= values["carbohydrates_g"] <= 176
                and 3 <= values["protein_g"] <= 176
                and 0 <= values["fat_g"] <= 176
                and 0 <= values["fiber_g"] <= 176
                and 0 <= values["amount_consumed_percent"] <= 100
            ):
                counts["invalid_rows_rejected"] += 1
            else:
                meal_records.append({
                    "participant_id": participant_id,
                    "recorded_at": recorded_at,
                    "meal_type": meal_type,
                    **values,
                    "source_file": source_file,
                    "source_row_number": source_row,
                })

    glucose_records, duplicates = exact_deduplicate(
        glucose_records,
        ("participant_id", "recorded_at", "cgm_device"),
        ("glucose_mg_dl",),
        "CGM",
    )
    counts["duplicate_rows_rejected"] += duplicates
    activity_records, duplicates = exact_deduplicate(
        activity_records,
        ("participant_id", "recorded_at"),
        ("heart_rate_bpm", "calories_activity_kcal", "activity_met", "source_mets_x10"),
        "Fitbit activity",
    )
    counts["duplicate_rows_rejected"] += duplicates
    meal_records, duplicates = exact_deduplicate(
        meal_records,
        ("participant_id", "recorded_at", "meal_type"),
        ("meal_calories_kcal", "carbohydrates_g", "protein_g", "fat_g",
         "fiber_g", "amount_consumed_percent"),
        "meal",
    )
    counts["duplicate_rows_rejected"] += duplicates
    return glucose_records, activity_records, meal_records, counts


def scan_source(
    archive: Path,
    on_participant: Callable[[str, Any], None] | None = None,
) -> dict[str, Any]:
    """Scan and validate one participant at a time, with optional upload callback."""
    if not archive.exists():
        download_archive(archive)
    checksum = sha256_file(archive)
    if checksum.lower() != SOURCE_SHA256:
        raise ValueError(
            f"Archive SHA-256 mismatch: {checksum}. Expected the official PhysioNet v1.0.0 checksum."
        )

    totals: dict[str, Any] = {
        "source_archive_sha256": checksum,
        "participant_rows_read": 0,
        "participant_rows_loaded": 0,
        "glucose_rows_read": 0,
        "glucose_rows_loaded": 0,
        "activity_rows_read": 0,
        "activity_rows_loaded": 0,
        "meal_rows_read": 0,
        "meal_rows_loaded": 0,
        "duplicate_rows_rejected": 0,
        "incomplete_rows_rejected": 0,
        "invalid_rows_rejected": 0,
        "warnings": [],
    }

    with zipfile.ZipFile(archive) as source:
        participant_files: dict[int, zipfile.ZipInfo] = {}
        bio_info: zipfile.ZipInfo | None = None
        for info in source.infolist():
            base = Path(info.filename).name
            number = parse_participant_number(base)
            if number is not None:
                if number in participant_files:
                    raise ValueError(f"More than one main CSV found for participant {number}.")
                participant_files[number] = info
            elif base.lower() == "bio.csv":
                bio_info = info

        if bio_info is None:
            raise FileNotFoundError("bio.csv was not found in the CGMacros archive.")
        participant_numbers = sorted(participant_files)
        if len(participant_numbers) != 45:
            raise ValueError(
                f"Expected 45 participant CSVs, found {len(participant_numbers)}."
            )

        bio = pd.read_csv(source.open(bio_info))
        participants = parse_bio_profiles(bio, participant_numbers)
        totals["participant_rows_read"] = len(bio)
        totals["participant_rows_loaded"] = len(participants)

        if on_participant:
            on_participant("participants", participants)

        for number in participant_numbers:
            info = participant_files[number]
            frame = pd.read_csv(source.open(info))
            participant_id = f"CGMacros-{number:03d}"
            glucose, activity, meals, counts = build_measurement_records(
                frame, participant_id, info.filename
            )

            totals["glucose_rows_read"] += counts["glucose_rows_read"]
            totals["glucose_rows_loaded"] += len(glucose)
            totals["activity_rows_read"] += counts["activity_rows_read"]
            totals["activity_rows_loaded"] += len(activity)
            totals["meal_rows_read"] += counts["meal_rows_read"]
            totals["meal_rows_loaded"] += len(meals)
            for key in (
                "duplicate_rows_rejected",
                "incomplete_rows_rejected",
                "invalid_rows_rejected",
            ):
                totals[key] += counts[key]

            if on_participant:
                on_participant("measurements", {
                    "glucose": glucose,
                    "activity": activity,
                    "meals": meals,
                })

            del frame, glucose, activity, meals

    return totals


def batched_upsert(client: Any, table: str, rows: list[dict[str, Any]], conflict: str) -> None:
    for start in range(0, len(rows), BATCH_SIZE):
        batch = rows[start:start + BATCH_SIZE]
        client.table(table).upsert(
            batch,
            on_conflict=conflict,
            ignore_duplicates=True,
        ).execute()
    if rows:
        print(f"{table}: upserted/submitted {len(rows):,} rows for current participant/batch.")


def write_to_supabase(archive: Path, preflight: dict[str, Any]) -> str:
    """Second pass upload. If interrupted, rerun safely because keys are unique."""
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise EnvironmentError(
            "Set SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) "
            "in the root .env. Never use the frontend anon key."
        )

    client = create_client(url, key)
    audit = {
        "dataset_name": "CGMacros",
        "dataset_version": SOURCE_VERSION,
        "source_doi": SOURCE_DOI,
        "source_archive_sha256": preflight["source_archive_sha256"],
        "import_status": "running",
        "participant_rows_read": preflight["participant_rows_read"],
        "participant_rows_loaded": preflight["participant_rows_loaded"],
        "glucose_rows_read": preflight["glucose_rows_read"],
        "glucose_rows_loaded": preflight["glucose_rows_loaded"],
        "activity_rows_read": preflight["activity_rows_read"],
        "activity_rows_loaded": preflight["activity_rows_loaded"],
        "meal_rows_read": preflight["meal_rows_read"],
        "meal_rows_loaded": preflight["meal_rows_loaded"],
        "duplicate_rows_rejected": preflight["duplicate_rows_rejected"],
        "incomplete_rows_rejected": preflight["incomplete_rows_rejected"],
        "invalid_rows_rejected": preflight["invalid_rows_rejected"],
        "notes": json.dumps({
            "mode": "two-pass; source fully validated before upload",
            "counts": "candidate complete rows; verify final DB row counts after import",
            "hba1c_unit": "Source dictionary says mmol/mol but paper grouping implies percent; verify with authors",
        }),
    }
    created = client.table("cgmacros_import_audit").insert(audit).execute()
    run_id = created.data[0]["import_run_id"]

    def upload_callback(stage: str, payload: Any) -> None:
        if stage == "participants":
            batched_upsert(
                client, "cgmacros_participants", payload, "participant_id"
            )
            return
        batched_upsert(
            client, "cgmacros_glucose_readings", payload["glucose"],
            "participant_id,recorded_at,cgm_device",
        )
        batched_upsert(
            client, "cgmacros_activity_readings", payload["activity"],
            "participant_id,recorded_at",
        )
        batched_upsert(
            client, "cgmacros_meal_events", payload["meals"],
            "participant_id,recorded_at,meal_type",
        )

    try:
        uploaded_report = scan_source(archive, on_participant=upload_callback)
        if uploaded_report["source_archive_sha256"] != preflight["source_archive_sha256"]:
            raise RuntimeError("Source archive checksum changed between validation and upload.")
        for key in (
            "participant_rows_loaded",
            "glucose_rows_loaded",
            "activity_rows_loaded",
            "meal_rows_loaded",
            "duplicate_rows_rejected",
            "incomplete_rows_rejected",
            "invalid_rows_rejected",
        ):
            if uploaded_report[key] != preflight[key]:
                raise RuntimeError(f"Preflight/upload count mismatch for {key}.")

        client.table("cgmacros_import_audit").update({
            "import_status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("import_run_id", run_id).execute()
    except Exception as exc:
        client.table("cgmacros_import_audit").update({
            "import_status": "failed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "notes": f"Import failed; rerun is safe after correcting issue: {type(exc).__name__}: {exc}",
        }).eq("import_run_id", run_id).execute()
        raise

    return str(run_id)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, default=DEFAULT_ARCHIVE)
    parser.add_argument(
        "--load",
        action="store_true",
        help="After preflight validation, write rows to Supabase. Default is dry-run only.",
    )
    args = parser.parse_args()

    report = scan_source(args.archive)
    report["source_archive"] = str(args.archive)
    report["rows_ready"] = {
        "participants": report["participant_rows_loaded"],
        "glucose": report["glucose_rows_loaded"],
        "activity": report["activity_rows_loaded"],
        "meals": report["meal_rows_loaded"],
    }
    print(json.dumps(report, indent=2))

    if not args.load:
        print("\nDRY RUN ONLY: no Supabase rows were written. Add --load to import.")
        return 0

    run_id = write_to_supabase(args.archive, report)
    print(f"\nImport completed. import_run_id={run_id}")
    print("Run verification SQL in docs/cgmacros-supabase-dataset.md.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"CGMacros import failed: {error}", file=sys.stderr)
        raise
