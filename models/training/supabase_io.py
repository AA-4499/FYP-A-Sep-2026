"""Server-only Supabase REST access shared by training and forecasting."""
from __future__ import annotations

import os
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(Path(__file__).resolve().parent / '.env')
load_dotenv(ROOT / '.env')


class SupabaseStorageError(RuntimeError):
    """Safe error message that never includes credentials or patient rows."""


def supabase_config():
    url = os.getenv('SUPABASE_URL', '').rstrip('/')
    key = (os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
           or os.getenv('SUPABASE_KEY', ''))
    if not url or not key or key.startswith('your_'):
        raise SupabaseStorageError('Configure SUPABASE_URL and a server-only Supabase secret/service-role key on the API server.')
    if key.startswith('sb_publishable_'):
        raise SupabaseStorageError('The API requires a server-only Supabase secret/service-role key, not a public publishable key.')
    return url, key


def supabase_headers(key):
    headers = {'apikey': key}
    # New sb_secret keys are API keys, not JWT access tokens.
    if not key.startswith(('sb_secret_', 'sb_publishable_')):
        headers['Authorization'] = f'Bearer {key}'
    return headers


def storage_failure(response):
    try:
        code = response.json().get('code', '')
    except (ValueError, AttributeError):
        code = ''
    if code in ('PGRST202', 'PGRST205', '42P01', '42883'):
        return SupabaseStorageError('Supabase forecast storage is not installed. Run models/training/supabase_forecast_outputs.sql in the Supabase SQL Editor.')
    if response.status_code in (401, 403):
        return SupabaseStorageError('Supabase rejected the server credentials or database permissions. Check the server-only secret/service-role key and table/function grants.')
    if code == '23503':
        return SupabaseStorageError('The forecast patient record is missing from patient_summary or its related run record. Check the patient ID and database relations.')
    if response.status_code == 409 or code == 'P0001':
        return SupabaseStorageError('This forecast run ID conflicts with an existing request. Start a new forecast.')
    return SupabaseStorageError(f'Supabase could not save the forecast (HTTP {response.status_code}). No successful save was confirmed.')
