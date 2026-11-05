import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from missiontwin.generate import generate  # noqa: E402
from missiontwin.ingest import load_baseline  # noqa: E402
from missiontwin.llm import LLMClient  # noqa: E402


@pytest.fixture(scope="session")
def data_dir(tmp_path_factory):
    """Golden path: run the real generators into a temp dir (never the committed copy)."""
    out = tmp_path_factory.mktemp("synthetic")
    generate(out)
    return out


@pytest.fixture(scope="session")
def offline_client(tmp_path_factory):
    return LLMClient(base_url="", cache_dir=tmp_path_factory.mktemp("cache"))


@pytest.fixture(scope="session")
def baseline(data_dir, offline_client):
    return load_baseline(data_dir, offline_client)


@pytest.fixture()
def log_path(tmp_path):
    return tmp_path / "activity.jsonl"


def signed_in(app, username="fleet.commander@us.navy.mil", **kwargs):
    """A test client with a session for the given account (the fleet account sees every unit)."""
    from fastapi.testclient import TestClient
    client = TestClient(app, **kwargs)
    assert client.post("/api/login", json={"username": username}).status_code == 200
    return client
