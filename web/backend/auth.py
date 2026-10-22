"""Supabase JWT authentication and role authorization helpers."""
from __future__ import annotations

import os
from functools import wraps
from typing import AbstractSet, Callable

import jwt
from flask import g, jsonify, request

ROLE_CLAIMS = ("role", "user_role")
APP_ROLES = frozenset({"admin", "patient", "doctor"})


def _token_from_request() -> str | None:
    value = request.headers.get("Authorization", "")
    if value.lower().startswith("bearer "):
        return value[7:].strip()
    return None


def _decode_token(token: str) -> dict:
    secret = os.environ.get("SUPABASE_JWT_SECRET")
    if not secret:
        # Supabase Auth verifies both legacy and asymmetric access tokens.
        # No JWT signing secret needs to be copied into this service.
        import requests
        from models.training.supabase_io import supabase_config, supabase_headers
        url, key = supabase_config()
        try:
            response = requests.get(f"{url}/auth/v1/user",
                headers={**supabase_headers(key), "Authorization": f"Bearer {token}"}, timeout=15)
        except requests.RequestException:
            raise RuntimeError("Supabase authentication is temporarily unavailable") from None
        if response.status_code != 200:
            raise jwt.InvalidTokenError("Supabase rejected the access token")
        user = response.json()
        if not user.get("id"):
            raise jwt.InvalidTokenError("Supabase returned no user identity")
        return {"sub": user["id"], "email": user.get("email"),
                "role": "authenticated", "app_metadata": user.get("app_metadata") or {}}
    audience = os.environ.get("SUPABASE_JWT_AUDIENCE", "authenticated")
    return jwt.decode(token, secret, algorithms=["HS256"], audience=audience, options={"require": ["sub", "exp"]})


def current_user() -> dict | None:
    return getattr(g, "current_user", None)


def require_auth(roles: AbstractSet[str] | None = None) -> Callable:
    def decorator(view: Callable) -> Callable:
        @wraps(view)
        def wrapped(*args, **kwargs):
            token = _token_from_request()
            if not token:
                return jsonify({"error": "Authentication required."}), 401
            try:
                claims = _decode_token(token)
            except (jwt.InvalidTokenError, RuntimeError) as exc:
                return jsonify({"error": "Invalid or expired access token.", "detail": str(exc)}), 401
            metadata = claims.get("app_metadata") or {}
            role = metadata.get("role") or next(
                (claims.get(key) for key in ROLE_CLAIMS if claims.get(key) in APP_ROLES | {"clinician"}),
                "patient",
            )
            # Accept existing accounts/tokens while exposing only the three platform roles.
            if role == "clinician":
                role = "doctor"
            if metadata.get("patient_id"):
                claims["patient_id"] = metadata["patient_id"]
            if roles and role not in roles:
                return jsonify({"error": "Insufficient role for this endpoint."}), 403
            g.current_user = {"id": claims["sub"], "email": claims.get("email"), "role": role or "patient", "claims": claims}
            return view(*args, **kwargs)
        return wrapped
    return decorator
