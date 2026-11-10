from flask import Blueprint, jsonify, g, request
from auth import require_auth, request_access_token
import requests
from models.training.supabase_io import supabase_config, supabase_headers
from services.retraining_service import start_training, training_status, data_readiness
from services.model_store import ModelStorageError

retraining_api = Blueprint('retraining_api', __name__)

@retraining_api.errorhandler(ModelStorageError)
def storage_unavailable(error):
    return jsonify(error=str(error)), 503


@retraining_api.before_request
def active_admin():
    # CORS preflights carry no user token; actual GET/POST still require live Admin access.
    if request.method == "OPTIONS":
        return None
    # Re-check the live profile so a suspended/demoted admin's old JWT cannot train.
    def check():
        try:
            url, key = supabase_config()
            response = requests.post(f'{url}/rest/v1/rpc/is_active_admin',
                headers={**supabase_headers(key), 'Authorization': f'Bearer {request_access_token()}'},
                json={}, timeout=15)
            response.raise_for_status()
            allowed = response.json() is True
        except (requests.RequestException, ValueError, RuntimeError):
            return jsonify(error='Unable to verify active administrator access.'), 503
        if not allowed:
            return jsonify(error='Active administrator access required.'), 403
    return require_auth(frozenset({'admin'}))(check)()


@retraining_api.get('/api/admin/model/retrain')
def status():
    return jsonify(training_status())


@retraining_api.post('/api/admin/model/retrain')
def retrain():
    try:
        return jsonify(start_training(g.current_user['id'])), 202
    except ValueError as exc:
        return jsonify(error=str(exc)), 409
    except OSError:
        return jsonify(error='Model storage is not writable. Configure a persistent model directory.'), 503


@retraining_api.get('/api/admin/model/readiness')
def readiness():
    try:
        return jsonify(data_readiness(refresh=request.args.get('refresh') == '1'))
    except (RuntimeError, ValueError, OSError, requests.RequestException):
        return jsonify(error='New-data statistics could not be loaded. Check Supabase access, data coverage, and model storage.'), 503
