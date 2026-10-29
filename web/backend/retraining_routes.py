from flask import Blueprint, jsonify, g
from auth import require_auth, request_access_token
import requests
from models.training.supabase_io import supabase_config, supabase_headers
from services.retraining_service import start_training, training_status

retraining_api = Blueprint('retraining_api', __name__)


@retraining_api.before_request
def active_admin():
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
