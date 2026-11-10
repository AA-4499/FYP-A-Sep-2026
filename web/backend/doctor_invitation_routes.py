"""Active-admin-only doctor invitations; Auth credentials stay on the server."""
import os
import re
from urllib.parse import urlsplit

import requests
from flask import Blueprint, jsonify, request

from auth import require_auth, request_access_token
from models.training.supabase_io import supabase_config, supabase_headers

doctor_invitation_api = Blueprint('doctor_invitation_api', __name__)


@doctor_invitation_api.post('/api/admin/doctors/invite')
@require_auth(frozenset({'admin'}))
def invite_doctor():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify(error='Enter the doctor information.'), 400
    fields = {'full_name': 120, 'email': 254, 'organisation': 160,
              'department': 160, 'registration_id': 120}
    details = {}
    for field, limit in fields.items():
        value = body.get(field)
        if not isinstance(value, str) or not value.strip() or len(value.strip()) > limit or re.search(r'[\x00-\x1f\x7f]', value):
            return jsonify(error=f'Enter a valid {field.replace("_", " ")} (up to {limit} characters).'), 400
        details[field] = value.strip()
    details['email'] = details['email'].lower()
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', details['email']):
        return jsonify(error='Enter a valid email address.'), 400

    # Never accept a redirect URL from the request or its Origin header.
    origin = os.environ.get('DOCTOR_INVITE_REDIRECT_URL', '').strip()
    parsed = urlsplit(origin)
    if (parsed.scheme not in ('https', 'http') or not parsed.netloc
            or parsed.username or parsed.password or parsed.fragment
            or (parsed.scheme == 'http' and parsed.hostname not in ('localhost', '127.0.0.1'))
            or parsed.query != 'auth=invite'):
        return jsonify(error='Configure DOCTOR_INVITE_REDIRECT_URL on the API server (app URL ending in ?auth=invite).'), 503
    try:
        url, key = supabase_config()
        # This RPC verifies the CURRENT profile role/status, validates all fields,
        # and reserves the email before any privileged Auth request is made.
        prepared = requests.post(f'{url}/rest/v1/rpc/admin_prepare_doctor_invitation',
            headers={**supabase_headers(key), 'Authorization': f'Bearer {request_access_token()}'},
            json={f'p_{field}': value for field, value in details.items()}, timeout=15)
        if not prepared.ok:
            failure = prepared.json()
            code = failure.get('code') if isinstance(failure, dict) else None
            if code == '42501':
                return jsonify(error='Active administrator access required.'), 403
            if code == '23505':
                return jsonify(error='An account already exists for this email. Manage the existing account instead.'), 409
            if code in ('PGRST202', '42883', '42P01'):
                return jsonify(error='Apply docs/supabase_doctor_invitations.sql before sending invitations.'), 503
            return jsonify(error='Could not prepare the invitation. Check the doctor information and try again.'), 400
        reservation = prepared.json()
        if not isinstance(reservation, dict) or not reservation.get('token'):
            return jsonify(error='The invitation service returned an invalid response.'), 503
        sent = requests.post(f'{url}/auth/v1/invite', headers=supabase_headers(key),
            params={'redirect_to': origin},
            json={'email': details['email'], 'data': {'doctor_invitation_token': reservation['token']}},
            timeout=30)
        if not sent.ok:
            if sent.status_code == 429:
                return jsonify(error='Invitation emails are rate limited. Please wait before trying again.'), 429
            return jsonify(error='The invitation email could not be sent. Check email delivery settings and the account list before retrying.'), 502
        user = sent.json()
        if (not isinstance(user, dict) or not user.get('id')
                or not isinstance(user.get('app_metadata'), dict)
                or user['app_metadata'].get('role') != 'doctor'
                or user['app_metadata'].get('doctor_invitation') != reservation['token']):
            return jsonify(error='Invitation delivery could not be confirmed. Check the account list before retrying.'), 502
        return jsonify(message='Invitation email sent. The doctor can open the link to choose a password.', email=details['email']), 201
    except (requests.RequestException, ValueError, RuntimeError):
        # A timeout may occur after Auth committed. Never claim delivery or delete
        # a possibly-created account; the administrator can inspect the directory.
        return jsonify(error='Invitation delivery could not be confirmed. Check the account list and email service before retrying.'), 503
