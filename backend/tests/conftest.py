from __future__ import annotations

import os
from pathlib import Path

TEST_DB = Path(__file__).parent / "test_scholarflow.db"
os.environ["SCHOLARFLOW_DB_PATH"] = str(TEST_DB)
# Tests must stay deterministic and offline: never call a live model or browser bridge.
os.environ["AI_PROVIDER"] = "off"

import pytest
from fastapi.testclient import TestClient

from app.database import init_db
from app import main as app_main
from app.main import app

# The tests exercise the tool endpoints directly, so disable the public-exposure
# guards that a real .env (with GENIOS_TOOL_TOKEN) would otherwise switch on.
app_main.GENIOS_TOOL_TOKEN = ""
app_main.PUBLIC_TOOL_ONLY = False


@pytest.fixture(scope="session")
def client():
    TEST_DB.unlink(missing_ok=True)
    init_db()
    with TestClient(app) as value:
        yield value
    TEST_DB.unlink(missing_ok=True)
