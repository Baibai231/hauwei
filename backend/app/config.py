from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")
DATA_DIR = PROJECT_ROOT / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
CHART_DIR = DATA_DIR / "charts"
DB_PATH = Path(os.getenv("SCHOLARFLOW_DB_PATH", str(DATA_DIR / "scholarflow.db")))

for directory in (DATA_DIR, UPLOAD_DIR, CHART_DIR):
    directory.mkdir(parents=True, exist_ok=True)

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "").rstrip("/")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "")
OPENALEX_EMAIL = os.getenv("OPENALEX_EMAIL", "")
