"""HW-152: routine per-minute lines stay out of the log.

httpx INFO (one line per Prometheus query), apscheduler executor INFO (a
start/finish pair per job run) and the uvicorn access line for every health
probe made up ~100% of this service's log volume. Warnings and errors from
the same loggers still ship.
"""

import logging

import pytest

from app.main import configure_logging


@pytest.fixture(autouse=True)
def _restore_loggers():
    names = ["httpx", "apscheduler", "uvicorn.access"]
    saved = {n: (logging.getLogger(n).level, list(logging.getLogger(n).filters)) for n in names}
    yield
    for n, (level, filters) in saved.items():
        lg = logging.getLogger(n)
        lg.setLevel(level)
        lg.filters[:] = filters


def _access_record(path: str, status: int = 200) -> logging.LogRecord:
    # uvicorn's access logger: args = (client, method, path, http_version, status)
    return logging.LogRecord(
        "uvicorn.access",
        logging.INFO,
        __file__,
        0,
        '%s - "%s %s HTTP/%s" %d',
        ("127.0.0.1:5000", "GET", path, "1.1", status),
        None,
    )


def test_httpx_and_apscheduler_info_dropped_warnings_kept():
    configure_logging()
    for name in ("httpx", "apscheduler.executors.default", "apscheduler.scheduler"):
        lg = logging.getLogger(name)
        assert not lg.isEnabledFor(logging.INFO), name
        assert lg.isEnabledFor(logging.WARNING), name


def test_health_access_line_dropped_other_requests_kept():
    configure_logging()
    access = logging.getLogger("uvicorn.access")
    assert not access.filter(_access_record("/api/v1/health"))
    assert access.filter(_access_record("/api/v1/nodes"))
    # A failing health check is worth seeing.
    assert access.filter(_access_record("/api/v1/health", 503))


def test_configure_logging_is_idempotent():
    configure_logging()
    configure_logging()
    assert len(logging.getLogger("uvicorn.access").filters) == 1
