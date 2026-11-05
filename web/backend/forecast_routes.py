"""GRU endpoints; authentication is enforced by the application's patient guard."""
import logging
import uuid
from flask import Blueprint, jsonify, request, g

forecast_api = Blueprint('forecast_api', __name__)


@forecast_api.post('/api/patients/<patient_id>/conditional-forecast')
def conditional_forecast(patient_id):
    try:
        from auth import request_access_token
        from services.medium_v3_service import forecast_patient
        return jsonify(forecast_patient(patient_id, request.get_json(silent=True), getattr(g, 'current_user', {}).get('role'), request_access_token()))
    except PermissionError as exc:
        return jsonify(error=str(exc)), 403
    except ValueError as exc:
        return jsonify(error=str(exc)), 400
    except LookupError as exc:
        return jsonify(error=str(exc)), 404
    except Exception:
        logging.exception('Medium v3 inference failed')
        return jsonify(error='The medium v3 service could not load its model or authorized records. Check the Render logs.'), 503


@forecast_api.get('/api/patients/<patient_id>/conditional-input')
def conditional_input(patient_id):
    try:
        from services.conditional_input_service import local_conditional_input
        return jsonify(local_conditional_input(patient_id))
    except LookupError as exc:
        return jsonify(error=str(exc)), 404
    except (OSError, ValueError):
        return jsonify(error='The local workbook or exact-visit summary could not be loaded.'), 503


@forecast_api.post('/api/patients/<patient_id>/glucose-forecast')
def glucose_forecast(patient_id):
    run_id = None
    try:
        from services.forecast_service import forecast_patient, validate_options
        from services.forecast_storage_service import save_forecast, validate_run_id
        payload = request.get_json(silent=True)
        _, _, events = validate_options(payload)
        run_id = validate_run_id(payload.get('run_id', str(uuid.uuid4())))
        result = forecast_patient(patient_id, payload)
        result['storage'] = save_forecast(result, events, run_id, getattr(g, 'current_user', {}).get('id'))
        return jsonify(result)
    except ValueError as exc:
        return jsonify(error=str(exc)), 400
    except LookupError as exc:
        return jsonify(error=str(exc)), 404
    except (RuntimeError, FileNotFoundError) as exc:
        return jsonify(error=str(exc), run_id=run_id, saved=False), 503
    except Exception:
        logging.exception('GRU forecast or storage failed')
        return jsonify(error='Unable to load CGM data, run the model, or confirm the Supabase save. Check the API server logs.', run_id=run_id, saved=False), 503
