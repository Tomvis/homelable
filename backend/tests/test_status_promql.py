"""check_method "promql": status read from Prometheus, never from a probe (Tomvis fork, HA-19)."""
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.core.config import settings
from app.services import status_checker
from app.services.status_checker import check_node

PROM = "http://prom:9090"


@pytest.fixture(autouse=True)
def _prom(monkeypatch):
    monkeypatch.setattr(settings, "promql_status_url", PROM)
    status_checker._promql_outage = False
    status_checker._promql_bad.clear()


def _vector(*values):
    return {"status": "success", "data": {"resultType": "vector",
            "result": [{"metric": {}, "value": [1791540000, v]} for v in values]}}


def _serve(handler):
    real = httpx.AsyncClient
    return patch("app.services.status_checker.httpx.AsyncClient",
                 side_effect=lambda **kw: real(transport=httpx.MockTransport(handler), **kw))


def _reply(body, status=200):
    return lambda request: httpx.Response(status, json=body)


@pytest.mark.asyncio
@pytest.mark.parametrize("values,want", [
    (("1",), "online"), (("0",), "offline"), (("0", "1"), "online"), (("0", "0"), "offline"),
    ((), "unknown"), (("NaN",), "unknown"), (("NaN", "0"), "offline"), (("0.5",), "online"),
])
async def test_promql_maps_samples_to_status(values, want):
    with _serve(_reply(_vector(*values))):
        assert await check_node("promql", 'up{job="x"}', None) == {"status": want, "response_time_ms": None}


@pytest.mark.asyncio
async def test_promql_sends_the_expression_to_the_query_api():
    seen = []

    def handler(request):
        seen.append(request.url)
        return httpx.Response(200, json=_vector("1"))

    with _serve(handler):
        await check_node("promql", 'max(up{job="x"})', "10.0.0.5")
    assert seen[0].host == "prom" and seen[0].path == "/api/v1/query"
    assert seen[0].params["query"] == 'max(up{job="x"})'


@pytest.mark.asyncio
async def test_promql_never_probes_the_device():
    with _serve(_reply(_vector("1"))), \
         patch("app.services.status_checker._ping", new_callable=AsyncMock) as ping, \
         patch("app.services.status_checker._http_get", new_callable=AsyncMock) as http_get, \
         patch("app.services.status_checker._tcp_connect", new_callable=AsyncMock) as tcp:
        await check_node("promql", "up", "10.0.0.5")
    ping.assert_not_called()
    http_get.assert_not_called()
    tcp.assert_not_called()


@pytest.mark.asyncio
async def test_promql_is_unknown_without_url_or_expression(monkeypatch):
    def boom(request):
        raise AssertionError("no query expected")

    with _serve(boom):
        assert (await check_node("promql", None, "10.0.0.5"))["status"] == "unknown"
        monkeypatch.setattr(settings, "promql_status_url", "")
        assert (await check_node("promql", "up", "10.0.0.5"))["status"] == "unknown"


@pytest.mark.asyncio
async def test_promql_outage_is_unknown_and_logged_once(caplog):
    def down(request):
        raise httpx.ConnectError("refused", request=request)

    with _serve(down), caplog.at_level("WARNING", logger="app.services.status_checker"):
        for _ in range(3):
            assert (await check_node("promql", "up", None))["status"] == "unknown"
    assert caplog.text.count("Prometheus unreachable") == 1


@pytest.mark.asyncio
async def test_promql_server_error_is_an_outage(caplog):
    with _serve(_reply({"status": "error"}, 503)), caplog.at_level("WARNING", logger="app.services.status_checker"):
        assert (await check_node("promql", "up", None))["status"] == "unknown"
    assert "Prometheus unreachable" in caplog.text


@pytest.mark.asyncio
async def test_promql_recovery_is_logged(caplog):
    def down(request):
        raise httpx.ConnectError("refused", request=request)

    with caplog.at_level("INFO", logger="app.services.status_checker"):
        with _serve(down):
            await check_node("promql", "up", None)
        with _serve(_reply(_vector("1"))):
            assert (await check_node("promql", "up", None))["status"] == "online"
    assert "Prometheus reachable again" in caplog.text


@pytest.mark.asyncio
async def test_promql_bad_query_is_unknown_and_logged_once_per_expression(caplog):
    bad = _reply({"status": "error", "errorType": "bad_data", "error": "parse error"}, 400)
    with _serve(bad), caplog.at_level("WARNING", logger="app.services.status_checker"):
        for _ in range(2):
            assert (await check_node("promql", "up{", None))["status"] == "unknown"
    assert caplog.text.count("promql status query") == 1


@pytest.mark.asyncio
async def test_promql_non_vector_result_is_unknown():
    scalar = {"status": "success", "data": {"resultType": "scalar", "result": [1791540000, "1"]}}
    with _serve(_reply(scalar)):
        assert (await check_node("promql", "1", None))["status"] == "unknown"


def test_promql_url_is_env_only(monkeypatch):
    from app.core.config import Settings
    monkeypatch.setenv("PROMQL_STATUS_URL", "http://p:9090")
    assert Settings().promql_status_url == "http://p:9090"
    assert Settings.model_fields["promql_status_url"].default == ""
