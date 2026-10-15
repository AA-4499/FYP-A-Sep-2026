"""Supabase JWT authentication and role authorization helpers."""
from __future__ import annotations

import os
from functools import wraps
from typing import Callable

import jwt
from flask import g, jsonify, request

ROLE_CLAIMS = ("role", "user_role")


def _token_from_request() -> str | None:
    value = request.headers.get("Authorization", "")
    if value.lower().startswith("bearer "):
        return value[7:].strip()
    return None


def _decode_token(token: str) -> dict:
    secret = os.environ.get("SUPABASE_JWT_SECRET")
    if not secret:
        raise RuntimeError("SUPABASE_JWT_SECRET is not configured")
    audience = os.environ.get("SUPABASE_JWT_AUDIENCE", "authenticated")
    return jwt.decode(token, secret, algorithms=["HS256"], audience=audience, options={"require": ["sub", "exp"]})


def current_user() -> dict | None:
    return getattr(g, "current_user", None)


def require_auth(roles: set[str] | None = None) -> Callable:
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
            role = next((claims.get(key) for key in ROLE_CLAIMS if claims.get(key)), None)
            if roles and role not in roles:
                return jsonify({"error": "Insufficient role for this endpoint."}), 403
            g.current_user = {"id": claims["sub"], "email": claims.get("email"), "role": role or "patient", "claims": claims}
            return view(*args, **kwargs)
        return wrapped
    return decorator
