"""Home theme claim (HW-64, Tomvis fork only).

authentik's `home_theme` scope adds {"theme", "mode", "override"} to the ID token. The SPA
themes itself from it, so the callback hands it over in a readable (non-HttpOnly) cookie that
lives as long as the session. No claim -> no cookie, and the SPA falls back to the default.
"""
import json
from collections.abc import Mapping
from typing import Any
from urllib.parse import quote

from starlette.responses import Response

from app.core.config import settings

HOME_THEME_COOKIE = "homelable-home-theme"


def home_theme_claim(userinfo: Mapping[str, Any]) -> dict[str, str] | None:
    claim = userinfo.get("home_theme")
    if not isinstance(claim, Mapping):
        return None
    out = {k: claim[k] for k in ("theme", "mode", "override") if isinstance(claim.get(k), str) and claim[k]}
    return out or None


def set_home_theme_cookie(response: Response, userinfo: Mapping[str, Any]) -> None:
    claim = home_theme_claim(userinfo)
    if claim is None:
        response.delete_cookie(HOME_THEME_COOKIE, path="/", secure=settings.oidc_cookie_secure, samesite="lax")
        return
    response.set_cookie(
        key=HOME_THEME_COOKIE,
        value=quote(json.dumps(claim, separators=(",", ":")), safe=""),
        max_age=settings.oidc_session_expire_minutes * 60,
        secure=settings.oidc_cookie_secure,
        httponly=False,
        samesite="lax",
        path="/",
    )
