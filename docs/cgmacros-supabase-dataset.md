# CGMacros dataset import for AI training

**Status:** Supabase schema prepared; raw participant records have not yet been imported.  
**Branch:** `KnowledgeGraph`  
**Source:** CGMacros PhysioNet v1.0.0, DOI [10.13026/3z8q-x658](https://doi.org/10.13026/3z8q-x658)

This document describes the dataset extract, cleaning rules, Supabase tables, import procedure, and extraction query for model training.

## 1. Dataset and scope

CGMacros contains 45 participants: 15 without diabetes, 16 with prediabetes, and 14 with Type 2 Diabetes. Each participant has approximately ten days of timestamped measurements. The main participant CSVs contain glucose from two CGM devices, Fitbit activity measures, and meal/macro events. The supplementary `bio.csv` contains participant profile information.

The original archive is approximately 627 MB compressed. It also contains meal photographs and supplementary microbiome/gut-health data. The first import is deliberately scoped to the numeric data useful for glucose/activity modelling:

- Participant profile: age, sex, BMI, HbA1c-derived group.
- Glucose: Libre and Dexcom readings in separate device-labelled rows.
- Fitbit activity: heart rate, activity calories, and MET.
- Meal events: meal type, calories, carbohydrates, protein, fat, fibre, and percentage consumed.

Meal images, image paths, microbiome features, and gut-health scores are not imported in this first exercise-focused extract. They are not required to join CGM and activity observations. The source archive remains the authoritative copy of those excluded materials.

**Important source properties**

- The original sensor sampling intervals were 15 minutes for Abbott FreeStyle Libre Pro and 5 minutes for Dexcom G6 Pro.
- The published main CSVs resample both glucose streams to a one-minute grid using linear interpolation. A one-minute value must therefore not be described as a new native sensor measurement.
- Fitbit records heart rate and MET at one-minute intervals. The source CSV stores MET multiplied by 10; the import divides it by 10 and also preserves the original value.
- CGMacros timestamps have been shifted by a random number of days (365–720 days) to protect dates. Relative timing within a participant is retained, but the timestamps are not the real calendar dates.

Sources: [PhysioNet data record and data dictionary](https://physionet.org/content/cgmacros/1.0.0/), [Scientific Data paper](https://doi.org/10.1038/s41597-025-05851-7).

## 2. Supabase tables

The tables are in the existing `FYP-A-Sep-2026` Supabase project, project ref `dgtaujhgwxmoghqdqkti`.

| Table | Grain (one row represents) | Main fields |
|---|---|---|
| `cgmacros_participants` | One participant | Participant ID, age, sex, BMI, HbA1c, diabetes group |
| `cgmacros_glucose_readings` | One participant, timestamp, CGM device | Glucose mg/dL, device, native sampling interval, source-interpolation provenance |
| `cgmacros_activity_readings` | One participant and timestamp | Heart rate bpm, activity calories kcal/min, MET, original MET×10 |
| `cgmacros_meal_events` | One participant, timestamp, meal type | Meal kcal, carbs/protein/fat/fibre grams, amount consumed % |
| `cgmacros_import_audit` | One import run | Source checksum, rows read/submitted, incomplete/invalid/duplicate counts, status |

### Keys and duplicate prevention

- Participant ID is the primary key in `cgmacros_participants`.
- Glucose readings use `(participant_id, recorded_at, cgm_device)` as the primary key.
- Activity readings use `(participant_id, recorded_at)` as the primary key.
- Meal events use `(participant_id, recorded_at, meal_type)` as the primary key.
- Additional unique source-file/row indexes prevent the same source row from being imported under a different timestamp.
- Re-running the importer is idempotent: identical existing keys are ignored, not duplicated. Conflicting duplicate keys in the source are treated as an error and stop the import.

### No-empty-field policy

There is no imputation or synthetic fill value in this import.

- A glucose row is inserted only when its timestamp and that device's glucose value are present and the glucose is within the source dictionary range of 40–400 mg/dL.
- An activity row is inserted only when timestamp, heart rate, activity calories, and MET are all present and within their documented ranges.
- A meal row is inserted only when the meal type and all six numeric meal fields are present and valid.
- A participant profile is inserted only when age, sex, BMI, and HbA1c are complete and pass source ranges.
- Incomplete or invalid source rows are excluded from their respective table and counted in `cgmacros_import_audit`. They are never changed to zero, forward-filled, or otherwise fabricated.

This is a *complete-case extract per measurement stream*. A missing Libre value does not discard an otherwise valid Dexcom or activity row. The joined model view below includes only timestamps for which participant profile, one CGM stream and the complete Fitbit activity record all exist.

## 3. Model-ready view

`public.cgmacros_training_observations` is a read-only view that inner-joins participant, glucose, and activity tables on participant ID and timestamp. Consequently, required fields in this view are not null.

Each timestamp can appear twice in the view (once for each CGM device). Do not treat the two device rows as independent time points. Choose one device for a given experiment, or explicitly model `cgm_device` as a device-specific feature. The paper reports differences between the two device series, so they should not be silently averaged.

Recommended query for a T2D-only exercise analysis:

```sql
SELECT
  participant_id,
  recorded_at,
  cgm_device,
  glucose_mg_dl,
  heart_rate_bpm,
  calories_activity_kcal,
  activity_met,
  age_years,
  sex,
  bmi,
  hba1c_percent
FROM public.cgmacros_training_observations
WHERE diabetes_group = 'Type 2 Diabetes'
  AND cgm_device = 'Abbott FreeStyle Libre Pro'
ORDER BY participant_id, recorded_at;
```

To use Dexcom instead, change the device filter to `Dexcom G6 Pro`. Meal observations are in `cgmacros_meal_events`; they are sparse events and should be joined as event/context features, not treated as one meal per minute.

## 4. Import procedure

The database schema is already created. The loader is:

`data/loaders/cgmacros_supabase_loader.py`

Run from the repository root on a machine with enough free disk space for the source archive and temporary processing. The archive is downloaded automatically if the default path does not exist.

### Install local dependencies

```powershell
python -m pip install pandas requests python-dotenv supabase
```

### Configure local Supabase credentials

Add these to the root `.env` file (already excluded from Git):

```dotenv
SUPABASE_URL=https://dgtaujhgwxmoghqdqkti.supabase.co
SUPABASE_SECRET_KEY=your_server_only_secret_key
```

A legacy `SUPABASE_SERVICE_ROLE_KEY` is also accepted. Use a server-only secret/service-role key for this one-time import. Never use or commit a frontend anon/publishable key or a real secret in Git.

### Dry run first

```powershell
python data/loaders/cgmacros_supabase_loader.py
```

The default mode downloads/validates the official v1.0.0 ZIP, checks its SHA-256 checksum, reads the 45 participant files and `bio.csv`, and reports candidate rows and rejected-row counts. It does not write to Supabase.

### Import after reviewing the dry-run output

```powershell
python data/loaders/cgmacros_supabase_loader.py --load
```

The loader submits data in batches and records an audit row. If a run is interrupted, rerun the same command: the database keys and idempotent upsert prevent duplicate rows. Check the final database counts rather than using the audit's submitted-row counts as exact inserted-row counts; a repeat run may submit rows that were already present.

The official archive SHA-256 is pinned in the script. A different checksum stops the import so a changed or wrong source file cannot be loaded silently.

## 5. Post-import verification SQL

Run these queries in Supabase SQL Editor.

### Population by diabetes group

```sql
SELECT diabetes_group, COUNT(*) AS participants
FROM public.cgmacros_participants
GROUP BY diabetes_group
ORDER BY diabetes_group;
```

Expected source profile counts: 15 no diabetes, 16 prediabetes, and 14 Type 2 Diabetes, provided all 45 complete profiles pass validation.

### Counts by table and glucose device

```sql
SELECT 'participants' AS table_name, COUNT(*) AS rows
FROM public.cgmacros_participants
UNION ALL
SELECT 'glucose', COUNT(*) FROM public.cgmacros_glucose_readings
UNION ALL
SELECT 'activity', COUNT(*) FROM public.cgmacros_activity_readings
UNION ALL
SELECT 'meals', COUNT(*) FROM public.cgmacros_meal_events;

SELECT cgm_device, COUNT(*) AS rows
FROM public.cgmacros_glucose_readings
GROUP BY cgm_device
ORDER BY cgm_device;
```

### Verify no duplicate keys

```sql
SELECT participant_id, recorded_at, cgm_device, COUNT(*)
FROM public.cgmacros_glucose_readings
GROUP BY participant_id, recorded_at, cgm_device
HAVING COUNT(*) > 1;

SELECT participant_id, recorded_at, COUNT(*)
FROM public.cgmacros_activity_readings
GROUP BY participant_id, recorded_at
HAVING COUNT(*) > 1;

SELECT participant_id, recorded_at, meal_type, COUNT(*)
FROM public.cgmacros_meal_events
GROUP BY participant_id, recorded_at, meal_type
HAVING COUNT(*) > 1;
```

All three queries should return zero rows.

### Verify no nulls in training view

```sql
SELECT COUNT(*) AS rows_with_missing_required_fields
FROM public.cgmacros_training_observations
WHERE participant_id IS NULL
   OR recorded_at IS NULL
   OR diabetes_group IS NULL
   OR cgm_device IS NULL
   OR glucose_mg_dl IS NULL
   OR heart_rate_bpm IS NULL
   OR calories_activity_kcal IS NULL
   OR activity_met IS NULL;
```

Expected result: zero.

### Latest import audit

```sql
SELECT *
FROM public.cgmacros_import_audit
ORDER BY started_at DESC
LIMIT 5;
```

## 6. Extracting the data in Python

A direct SQL query is preferable for large extracts. If using Supabase Python/PostgREST, paginate results instead of relying on the default response limit.

```python
from supabase import create_client
import os

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SECRET_KEY"],  # server-side only
)

rows = []
page_size = 1000
start = 0

while True:
    response = (
        supabase.table("cgmacros_training_observations")
        .select("*")
        .eq("diabetes_group", "Type 2 Diabetes")
        .eq("cgm_device", "Abbott FreeStyle Libre Pro")
        .order("participant_id")
        .order("recorded_at")
        .range(start, start + page_size - 1)
        .execute()
    )
    batch = response.data or []
    rows.extend(batch)
    if len(batch) < page_size:
        break
    start += page_size
```

For model evaluation, split train/validation/test by **participant**, not random rows. Random row splits allow the same person's adjacent glucose sequence to appear in both training and testing and can inflate performance. The 14-person T2D subset is small; report participant-level validation carefully and do not claim the data alone establish causal exercise effects.

## 7. Security and licence

Both the raw tables and model-ready view have RLS enabled. Authenticated users can read the research rows; anonymous users cannot. ETL writes are reserved for the server-side secret/service-role credential.

The dataset licence is **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 (CC BY-NC-SA 4.0)**. Retain attribution, use the data for non-commercial purposes, and follow the ShareAlike requirement when distributing adapted material. Do not redistribute source images or data outside the licence terms.

Suggested citation:

Gutierrez-Osuna, R., Kerr, D., Mortazavi, B., & Das, A. (2025). *CGMacros: a scientific dataset for personalized nutrition and diet monitoring* (version 1.0.0). PhysioNet. https://doi.org/10.13026/3z8q-x658

Das, A., Kerr, D., Glantz, N., et al. (2025). CGMacros: a pilot scientific dataset for personalized nutrition and diet monitoring. *Scientific Data, 12*, 1557. https://doi.org/10.1038/s41597-025-05851-7

## 8. Explicit exclusions and limitations

- This first import does not load meal photographs, microbiome feature vectors, or gut-health ordinal scores. They are outside the initial CGM/exercise feature scope.
- The main CGM series is one-minute interpolated source data, not native one-minute sensor capture.
- Fitbit MET is a proxy/estimate and is not a clinician-labelled exercise category.
- The cohort has 14 T2D participants and about ten days of data per participant. It is useful for exploratory feature development, but not a large independent T2D training cohort.
- CGMacros is observational free-living data; association between activity and glucose does not prove causation.
- Study dates were shifted. Do not interpret the calendar date as the participant's actual date.
