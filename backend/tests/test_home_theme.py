"""Home theme claim cookie (HW-64, Tomvis fork)."""
import json
from unittest.mock import patch
from urllib.parse import unquote

from httpx import AsyncClient

from app.core.home_theme import home_theme_claim
from tests.test_auth import FakeOIDCClient, oidc_settings  # noqa: F401  (fixture)

USER = {"iss": "https://idp.example/application/o/homelable/", "sub": "user-123", "preferred_username": "tom"}


def _cookie(res, name):
    for header in res.headers.get_list("set-cookie"):
        if header.startswith(f"{name}="):
            return header
    return None


def test_claim_keeps_only_known_string_fields():
    assert home_theme_claim({"home_theme": {"theme": "dusk", "mode": "dark", "override": "follow", "x": 1}}) == {
        "theme": "dusk", "mode": "dark", "override": "follow"}
    assert home_theme_claim({"home_theme": "dusk"}) is None
    assert home_theme_claim({}) is None


async def test_callback_hands_the_claim_to_the_spa(client: AsyncClient, oidc_settings):  # noqa: F811
    claim = {"theme": "glacier", "mode": "light", "override": "glacier/light"}
    fake = FakeOIDCClient(token={"userinfo": {**USER, "home_theme": claim}})
    with patch("app.api.routes.auth.get_oidc_client", return_value=fake):
        res = await client.get("/api/v1/auth/oidc/callback")
    assert res.status_code == 303
    cookie = _cookie(res, "homelable-home-theme")
    assert cookie is not None and "HttpOnly" not in cookie and "Path=/" in cookie
    assert json.loads(unquote(cookie.split(";")[0].split("=", 1)[1])) == claim


async def test_callback_without_claim_clears_the_cookie(client: AsyncClient, oidc_settings):  # noqa: F811
    fake = FakeOIDCClient(token={"userinfo": USER})
    with patch("app.api.routes.auth.get_oidc_client", return_value=fake):
        res = await client.get("/api/v1/auth/oidc/callback")
    cookie = _cookie(res, "homelable-home-theme")
    assert cookie is not None and "Max-Age=0" in cookie
