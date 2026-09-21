from __future__ import annotations

import os
from pathlib import Path

TEST_DB = Path(__file__).parent / "test_scholarflow.db"
os.environ["SCHOLARFLOW_DB_PATH"] = str(TEST_DB)

import pytest
from fastapi.testclient import TestClient

from app.database import init_db
from app.main import app


@pytest.fixture(scope="session")
def client():
    TEST_DB.unlink(missing_ok=True)
    init_db()
    with TestClient(app) as value:
        yield value
    TEST_DB.unlink(missing_ok=True)
