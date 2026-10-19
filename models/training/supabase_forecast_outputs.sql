-- Run once in Supabase SQL Editor. Existing training_* tables are retained.
-- Future forecasts and held-out evaluation outputs are saved atomically.
BEGIN;
CREATE TABLE IF NOT EXISTS public.glucose_forecasts (
    run_id UUID PRIMARY KEY,
    patient_id TEXT NOT NULL,
    record_id TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('supabase', 'local')),
    horizon_hours INTEGER NOT NULL CHECK (horizon_hours IN (3, 6, 12)),
    forecast_start TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    model_sha256 TEXT NOT NULL,
    payload_sha256 TEXT NOT NULL,
    scenario_events JSONB NOT NULL DEFAULT '[]'::jsonb,
    output JSONB NOT NULL,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_glucose_forecasts_patient_created
    ON public.glucose_forecasts (patient_id, created_at DESC);
ALTER TABLE public.glucose_forecasts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.glucose_forecasts FROM anon, authenticated;
GRANT SELECT, INSERT ON public.glucose_forecasts TO service_role;


-- One parent record for every offline training run and interactive forecast.
CREATE TABLE IF NOT EXISTS public.model_runs (
    run_id TEXT PRIMARY KEY,
    run_type TEXT NOT NULL CHECK (run_type IN ('training', 'forecast')),
    source TEXT CHECK (source IN ('supabase', 'local')),
    model_sha256 TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.model_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.model_runs FROM anon, authenticated;
GRANT SELECT, INSERT ON public.model_runs TO service_role;

-- Existing output rows retain their IDs, values and timestamps.
INSERT INTO public.model_runs (run_id, run_type)
SELECT run_id, 'training' FROM (
    SELECT run_id FROM public.training_predictions
    UNION SELECT run_id FROM public.training_metrics
    UNION SELECT run_id FROM public.training_timeline_splits
) AS existing_runs ON CONFLICT (run_id) DO NOTHING;
INSERT INTO public.model_runs (run_id, run_type, source, model_sha256)
SELECT run_id::text, 'forecast', source, model_sha256 FROM public.glucose_forecasts
ON CONFLICT (run_id) DO NOTHING;

-- Existing training IDs are text; retain the forecast UUID API and expose a
-- generated text key for a real FK to the same parent.
ALTER TABLE public.glucose_forecasts ADD COLUMN IF NOT EXISTS run_key TEXT
    GENERATED ALWAYS AS (run_id::text) STORED;
DO $relations$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'training_predictions_model_run_fk'
                   AND conrelid = 'public.training_predictions'::regclass) THEN
        ALTER TABLE public.training_predictions ADD CONSTRAINT training_predictions_model_run_fk
            FOREIGN KEY (run_id) REFERENCES public.model_runs(run_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'training_metrics_model_run_fk'
                   AND conrelid = 'public.training_metrics'::regclass) THEN
        ALTER TABLE public.training_metrics ADD CONSTRAINT training_metrics_model_run_fk
            FOREIGN KEY (run_id) REFERENCES public.model_runs(run_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'training_splits_model_run_fk'
                   AND conrelid = 'public.training_timeline_splits'::regclass) THEN
        ALTER TABLE public.training_timeline_splits ADD CONSTRAINT training_splits_model_run_fk
            FOREIGN KEY (run_id) REFERENCES public.model_runs(run_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'glucose_forecasts_model_run_fk'
                   AND conrelid = 'public.glucose_forecasts'::regclass) THEN
        ALTER TABLE public.glucose_forecasts ADD CONSTRAINT glucose_forecasts_model_run_fk
            FOREIGN KEY (run_key) REFERENCES public.model_runs(run_id);
    END IF;
END;
$relations$;
CREATE INDEX IF NOT EXISTS idx_training_splits_run_id ON public.training_timeline_splits(run_id);


-- Preserve historical short record IDs and the cohort metric ID 'ALL'.
-- The nullable FK stores the exact patient_summary key when it can be resolved.
ALTER TABLE public.training_predictions ADD COLUMN IF NOT EXISTS patient_record_id TEXT;
ALTER TABLE public.training_metrics ADD COLUMN IF NOT EXISTS patient_record_id TEXT;
ALTER TABLE public.training_timeline_splits ADD COLUMN IF NOT EXISTS patient_record_id TEXT;
DO $patients$
DECLARE
    output_table TEXT;
    fk_name TEXT;
BEGIN
    FOREACH output_table IN ARRAY ARRAY['training_predictions', 'training_metrics', 'training_timeline_splits'] LOOP
        EXECUTE format($backfill$
            UPDATE public.%I AS output SET patient_record_id = matched.record_id
            FROM (
                SELECT existing.patient_id, min(summary."Patient Number") AS record_id
                FROM (SELECT DISTINCT patient_id FROM public.%I) AS existing
                JOIN public.patient_summary AS summary
                  ON summary."Patient Number" = existing.patient_id
                  OR regexp_replace(summary."Patient Number", '_[0-9]{8}$', '') = existing.patient_id
                GROUP BY existing.patient_id HAVING count(*) = 1
            ) AS matched
            WHERE output.patient_id = matched.patient_id AND output.patient_record_id IS NULL
        $backfill$, output_table, output_table);
        fk_name := output_table || '_patient_record_fk';
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = fk_name
                       AND conrelid = format('public.%I', output_table)::regclass) THEN
            EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (patient_record_id) REFERENCES public.patient_summary ("Patient Number")', output_table, fk_name);
        END IF;
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(patient_record_id)', 'idx_' || output_table || '_patient_record', output_table);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'glucose_forecasts_patient_fk'
                   AND conrelid = 'public.glucose_forecasts'::regclass) THEN
        ALTER TABLE public.glucose_forecasts ADD CONSTRAINT glucose_forecasts_patient_fk
            FOREIGN KEY (patient_id) REFERENCES public.patient_summary("Patient Number");
    END IF;
END;
$patients$;

CREATE OR REPLACE FUNCTION public.save_glucose_forecast(p_run JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    saved public.glucose_forecasts%ROWTYPE;
    inserted_count INTEGER;
    prediction_count INTEGER;
    metric_count INTEGER;
    split_count INTEGER;
BEGIN
    INSERT INTO public.model_runs (run_id, run_type, source, model_sha256)
    VALUES (p_run->>'run_id', 'forecast', p_run->>'source', p_run->>'model_sha256')
    ON CONFLICT (run_id) DO NOTHING;
    INSERT INTO public.glucose_forecasts (
        run_id, patient_id, record_id, source, horizon_hours, forecast_start,
        model_sha256, payload_sha256, scenario_events, output, created_by
    ) VALUES (
        (p_run->>'run_id')::uuid, p_run->>'patient_id', p_run->>'record_id',
        p_run->>'source', (p_run->>'horizon_hours')::integer,
        (p_run->>'forecast_start')::timestamp, p_run->>'model_sha256',
        p_run->>'payload_sha256', p_run->'scenario_events', p_run->'output',
        NULLIF(p_run->>'created_by', '')::uuid
    ) ON CONFLICT (run_id) DO NOTHING;
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    SELECT * INTO STRICT saved FROM public.glucose_forecasts
        WHERE run_id = (p_run->>'run_id')::uuid;
    IF saved.patient_id <> p_run->>'patient_id'
       OR saved.payload_sha256 <> p_run->>'payload_sha256'
       OR saved.created_by IS DISTINCT FROM NULLIF(p_run->>'created_by', '')::uuid THEN
        RAISE EXCEPTION 'Forecast run ID already belongs to a different request';
    END IF;
    IF inserted_count = 1 THEN
        INSERT INTO public.training_timeline_splits (
            run_id, patient_id, patient_record_id, timeline_start, timeline_end, train_target_end_exclusive,
            test_target_start, observed_rows, training_rows, testing_rows, test_windows
        ) VALUES (
            saved.run_id::text, saved.patient_id, saved.patient_id,
            (saved.output->'timeline_split'->>'timeline_start')::timestamp AT TIME ZONE 'UTC',
            (saved.output->'timeline_split'->>'timeline_end')::timestamp AT TIME ZONE 'UTC',
            (saved.output->'timeline_split'->>'train_target_end_exclusive')::timestamp AT TIME ZONE 'UTC',
            (saved.output->'timeline_split'->>'test_target_start')::timestamp AT TIME ZONE 'UTC',
            (saved.output->'timeline_split'->>'observed_rows')::integer,
            (saved.output->'timeline_split'->>'training_rows')::integer,
            (saved.output->'timeline_split'->>'testing_rows')::integer,
            (saved.output->'timeline_split'->>'test_windows')::integer
        );
        INSERT INTO public.training_predictions (
            run_id, patient_id, patient_record_id, timestamp, actual_glucose_mg_dl, predicted_glucose_mg_dl
        ) SELECT saved.run_id::text, saved.patient_id, saved.patient_id,
                 (point->>'timestamp')::timestamp AT TIME ZONE 'UTC',
                 (point->>'actual_glucose_mg_dl')::double precision,
                 (point->>'predicted_glucose_mg_dl')::double precision
          FROM jsonb_array_elements(p_run->'testing_rows') AS point;
        IF jsonb_typeof(saved.output->'metrics') = 'object' THEN
            INSERT INTO public.training_metrics (
                run_id, patient_id, patient_record_id, mae_mg_dl, rmse_mg_dl, test_windows
            ) VALUES (
                saved.run_id::text, saved.patient_id, saved.patient_id,
                (saved.output->'metrics'->>'mae_mg_dl')::double precision,
                (saved.output->'metrics'->>'rmse_mg_dl')::double precision,
                (saved.output->'metrics'->>'test_windows')::integer
            );
        END IF;
    END IF;
    SELECT count(*) INTO prediction_count FROM public.training_predictions
        WHERE run_id = saved.run_id::text;
    SELECT count(*) INTO metric_count FROM public.training_metrics WHERE run_id = saved.run_id::text;
    SELECT count(*) INTO split_count FROM public.training_timeline_splits WHERE run_id = saved.run_id::text;
    RETURN jsonb_build_object('saved', true, 'run_id', saved.run_id,
        'patient_id', saved.patient_id, 'created_at', saved.created_at,
        'test_predictions_saved', prediction_count, 'metrics_saved', metric_count, 'timeline_splits_saved', split_count);
END;
$$;
REVOKE ALL ON FUNCTION public.save_glucose_forecast(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_glucose_forecast(JSONB) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
