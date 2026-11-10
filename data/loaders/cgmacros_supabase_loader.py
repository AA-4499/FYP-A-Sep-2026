#!/usr/bin/env python3
"""Validate and import the public CGMacros 1.0.0 dataset into Supabase.

The script never fills missing measurements. It keeps complete records in
separate participant, glucose, activity and meal tables, rejects invalid rows,
and uses Supabase uniqueness constraints for idempotent imports.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import zipfile
from pathlib import Path
from typing import Any

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
    """Drop identical duplicate keys, but stop on conflicting duplicate values."""
    seen: dict[tuple[Any, ...], tuple[Any, ...]] = {}
    output: list[dict[str, Any]] = []
    duplicates = 0
    for record in records:
        key = tuple(record[field] for field in key_fields)
        values = tuple(record[field] for field in value_fields)
        if key in seen:
            if seen[key] != values:
                raise ValueError(
                    f"Conflicting duplicate {label} key {key}; "
                    "review the source CSV instead of silently choosing a row."
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
    """Use explicit participant identifiers where present; otherwise follow
    the row-order mapping used by the original CGMacros analysis notebook.
    """
    required = {
        "age": find_column(bio, ["Age"]),
        "sex": find_column(bio, ["Gender"]),
        "bmi": find_column(bio, ["BMI"]),
        "hba1c": find_column(bio, ["A1c PDL (Lab)", "A1c"]),
    }
    missing_columns = [key for key, value in required.items() if value is None]
    if missing_columns:
        raise ValueError(
            "bio.csv is missing required profile columns: " + ", ".join(missing_columns)
        )

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
            raise ValueError(
                "bio.csv participant ID column was found, but one or more main-file "
                "participants could not be matched."
            )
    else:
        if len(bio) != len(participant_numbers):
            raise ValueError(
                "bio.csv has no recognisable participant ID column and its row count "
                "does not match the number of participant CSV files. Refusing to guess."
            )
        print(
            "NOTE: bio.csv has no participant ID column. Mapping its rows in order "
            "to the sorted participant CSV IDs, matching the original publisher notebook."
        )
        rows_by_number = {
            number: bio.iloc[index]
            for index, number in enumerate(participant_numbers)
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
                f"Participant CGMacros-{number:03d} lacks a required profile value. "
                "No value will be imputed."
            )
        if not (18 <= age <= 69 and 20.69 <= bmi <= 49.09 and 4.6 <= hba1c <= 8.5):
            raise ValueError(
                f"Participant CGMacros-{number:03d} has a profile value outside "
                "the published data-dictionary ranges."
            )

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
    """Create three complete-case streams from one participant CSV."""
    columns = {normalise_name(col): col for col in frame.columns}
    missing = [name for name in REQUIRED_MAIN_COLUMNS if normalise_name(name) not in columns]
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

        # CGM columns are separate streams. The source publication says both
        # series were linearly interpolated to a 1-minute grid.
        for device, field, native_interval in (
            ("Abbott FreeStyle Libre Pro", "Libre GL", 15),
            ("Dexcom G6 Pro", "Dexcom GL", 5),
        ):
            value = as_number(frame.iloc[index][col(field)])
            if value is None:
                counts["incomplete_rows_rejected"] += 1
                continue
            if not 40 <= value <= 400:
                counts["invalid_rows_rejected"] += 1
                continue
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

        # Require all three Fitbit features for an activity row. No partial or
        # empty activity records are sent to the complete-case table.
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
            meal_type = str(meal_value).strip().lower()
            meal_type = {
                "breakfast": "Breakfast",
                "lunch": "Lunch",
                "dinner": "Dinner",
            }.get(meal_type)
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
                continue
            if not (
                30 <= values["meal_calories_kcal"] <= 1180
                and 0 <= values["carbohydrates_g"] <= 176
                and 3 <= values["protein_g"] <= 176
                and 0 <= values["fat_g"] <= 176
                and 0 <= values["fiber_g"] <= 176
                and 0 <= values["amount_consumed_percent"] <= 100
            ):
                counts["invalid_rows_rejected"] += 1
                continue
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


def load_source(archive: Path) -> tuple[dict[str, Any], dict[str, list[dict[str, Any]]]]:
    if not archive.exists():
        download_archive(archive)
    checksum = sha256_file(archive)
    if checksum.lower() != SOURCE_SHA256:
        raise ValueError(
            f"CGMacros archive SHA-256 mismatch: {checksum}. "
            "Expected the official PhysioNet 1.0.0 archive checksum."
        )

    with zipfile.ZipFile(archive) as source:
        participant_files: dict[int, zipfile.ZipInfo] = {}
        bio_info: zipfile.ZipInfo | None = None
        for info in source.infolist():
            base = Path(info.filename).name
            number = parse_participant_number(base)
            if number is not None:
                if number in participant_files:
                    raise ValueError(f"More than one main CSV found for participant {number}")
                participant_files[number] = info
            elif base.lower() == "bio.csv":
                bio_info = info

        if bio_info is None:
            raise FileNotFoundError("bio.csv was not found in the CGMacros archive.")
        participant_numbers = sorted(participant_files)
        if len(participant_numbers) != 45:
            raise ValueError(
                f"Expected 45 participant CSVs in CGMacros 1.0.0, found {len(participant_numbers)}."
            )

        bio = pd.read_csv(source.open(bio_info))
        participants = parse_bio_profiles(bio, participant_numbers)

        streams = {"glucose": [], "activity": [], "meals": []}
        totals = {
            "source_archive_sha256": checksum,
            "participant_rows_read": len(bio),
            "participant_rows_loaded": len(participants),
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

        for number in participant_numbers:
            info = participant_files[number]
            frame = pd.read_csv(source.open(info))
            participant_id = f"CGMacros-{number:03d}"
            glucose, activity, meals, counts = build_measurement_records(
                frame, participant_id, info.filename
            )
            streams["glucose"].extend(glucose)
            streams["activity"].extend(activity)
            streams["meals"].extend(meals)
            for key, value in counts.items():
                totals[key] = totals.get(key, 0) + value

        totals["glucose_rows_loaded"] = len(streams["glucose"])
        totals["activity_rows_loaded"] = len(streams["activity"])
        totals["meal_rows_loaded"] = len(streams["meals"])
        totals["participant_rows_loaded"] = len(participants)
        streams["participants"] = participants

    return totals, streams


def batched_upsert(client: Any, table: str, rows: list[dict[str, Any]], conflict: str) -> None:
    for start in range(0, len(rows), BATCH_SIZE):
        batch = rows[start:start + BATCH_SIZE]
        client.table(table).upsert(
            batch,
            on_conflict=conflict,
            ignore_duplicates=True,
        ).execute()
        print(f"{table}: submitted {min(start + len(batch), len(rows)):,}/{len(rows):,}")


def write_to_supabase(report: dict[str, Any], streams: dict[str, list[dict[str, Any]]]) -> str:
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise EnvironmentError(
            "Set SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) "
            "in the local environment. Never use the public anon key for this import."
        )

    client = create_client(url, key)
    audit = {
        "dataset_name": "CGMacros",
        "dataset_version": SOURCE_VERSION,
        "source_doi": SOURCE_DOI,
        "source_archive_sha256": report["source_archive_sha256"],
        "import_status": "running",
        "participant_rows_read": report["participant_rows_read"],
        "participant_rows_loaded": report["participant_rows_loaded"],
        "glucose_rows_read": report["glucose_rows_read"],
        "glucose_rows_loaded": report["glucose_rows_loaded"],
        "activity_rows_read": report["activity_rows_read"],
        "activity_rows_loaded": report["activity_rows_loaded"],
        "meal_rows_read": report["meal_rows_read"],
        "meal_rows_loaded": report["meal_rows_loaded"],
        "duplicate_rows_rejected": report["duplicate_rows_rejected"],
        "incomplete_rows_rejected": report["incomplete_rows_rejected"],
        "invalid_rows_rejected": report["invalid_rows_rejected"],
        "notes": json.dumps({
            "import_mode": "idempotent upsert; exact duplicate keys ignored",
            "warnings": report.get("warnings", []),
            "rows_loaded_are_submitted_complete_rows": True,
        }),
    }
    created = client.table("cgmacros_import_audit").insert(audit).execute()
    run_id = created.data[0]["import_run_id"]

    try:
        batched_upsert(
            client, "cgmacros_participants", streams["participants"], "participant_id"
        )
        batched_upsert(
            client, "cgmacros_glucose_readings", streams["glucose"],
            "participant_id,recorded_at,cgm_device",
        )
        batched_upsert(
            client, "cgmacros_activity_readings", streams["activity"],
            "participant_id,recorded_at",
        )
        batched_upsert(
            client, "cgmacros_meal_events", streams["meals"],
            "participant_id,recorded_at,meal_type",
        )
        client.table("cgmacros_import_audit").update({
            "import_status": "completed",
            "completed_at": "now()",
            "notes": json.dumps({
                "import_mode": "idempotent upsert",
                "note": "Loaded/submitted counts are candidate complete rows; run verification SQL "
                        "from docs/cgmacros-supabase-dataset.md for exact final table counts.",
            }),
        }).eq("import_run_id", run_id).execute()
    except Exception as exc:
        client.table("cgmacros_import_audit").update({
            "import_status": "failed",
            "completed_at": "now()",
            "notes": f"Import failed: {type(exc).__name__}: {exc}",
        }).eq("import_run_id", run_id).execute()
        raise

    return str(run_id)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, default=DEFAULT_ARCHIVE)
    parser.add_argument(
        "--load", action="store_true",
        help="Write validated records to Supabase. Without this flag, only a dry run is performed.",
    )
    args = parser.parse_args()

    report, streams = load_source(args.archive)
    report["source_archive"] = str(args.archive)
    report["rows_ready"] = {
        "participants": len(streams["participants"]),
        "glucose": len(streams["glucose"]),
        "activity": len(streams["activity"]),
        "meals": len(streams["meals"]),
    }

    if not args.load:
        print(json.dumps(report, indent=2))
        print("\nDRY RUN ONLY: no Supabase rows were written. Add --load to import.")
        return 0

    run_id = write_to_supabase(report, streams)
    print(f"\nImport submitted successfully. import_run_id={run_id}")
    print("Run the verification SQL in docs/cgmacros-supabase-dataset.md.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"CGMacros import failed: {error}", file=sys.stderr)
        raise
