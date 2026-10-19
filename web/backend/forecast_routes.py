"""GRU endpoints; authentication is enforced by the application's patient guard."""
import logging
import uuid
from flask import Blueprint, jsonify, request, g

forecast_api = Blueprint('forecast_api', __name__)


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
