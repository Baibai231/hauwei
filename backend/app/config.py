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

# AI provider selection: "auto" | "openai" | "coze" | "off".
# "auto" prefers NK-GeniOS/Coze credentials when present, then an OpenAI-compatible provider.
AI_PROVIDER = os.getenv("AI_PROVIDER", "auto").strip().lower()
AI_TIMEOUT_SECONDS = float(os.getenv("AI_TIMEOUT_SECONDS", "120"))

# NK-GeniOS (Coze) agent configuration.
GENIOS_BASE_URL = os.getenv("GENIOS_BASE_URL", "").rstrip("/")
GENIOS_API_KEY = os.getenv("GENIOS_API_KEY", "")
GENIOS_AGENT_ID = os.getenv("GENIOS_AGENT_ID", "")
GENIOS_USER_ID = os.getenv("GENIOS_USER_ID", "scholarflow-local")

# Chat path appended to GENIOS_BASE_URL. Public Coze uses /v3/chat; the Nankai
# deployment exposes its own proxy base, so the exact path must be confirmed from
# the platform's "接口说明" page. Override with GENIOS_CHAT_PATH when it differs.
_genios_chat_path = os.getenv("GENIOS_CHAT_PATH", "/v3/chat").strip()
if _genios_chat_path.lower() in {"-", "none", "(none)"}:
    # Sentinel for "POST exactly to GENIOS_BASE_URL" (an empty Windows env var
    # would otherwise fall back to the default value).
    _genios_chat_path = ""
elif _genios_chat_path and not _genios_chat_path.startswith("/"):
    _genios_chat_path = f"/{_genios_chat_path}"
GENIOS_CHAT_PATH = _genios_chat_path

# When set (e.g. "api_key"), the secret is sent as a query parameter instead of
# the Authorization header. The Nankai MCP channel exposes ?api_key=<key>, so the
# API channel may use the same scheme.
GENIOS_API_KEY_PARAM = os.getenv("GENIOS_API_KEY_PARAM", "").strip()

# --- Local browser bridge (AI_PROVIDER=genios_browser) ----------------------
# The Nankai deployment gates /api/* behind campus SSO, so the backend can reuse
# an already-authenticated local browser over the CDP debugging port instead of
# storing any campus credential.
BROWSER_CDP_URL = os.getenv("BROWSER_CDP_URL", "http://127.0.0.1:9222").rstrip("/")
BROWSER_TARGET_HOST = os.getenv("BROWSER_TARGET_HOST", "coze.nankai.edu.cn")
BROWSER_CHAT_URL = os.getenv(
    "BROWSER_CHAT_URL", "https://coze.nankai.edu.cn/product/llm/chat/db42qo54shhbpg8vnl40"
)
BROWSER_TIMEOUT_SECONDS = float(os.getenv("BROWSER_TIMEOUT_SECONDS", "240"))
# Start a fresh conversation for every prompt so one call cannot leak context into
# the next one. Set to false to keep appending to the current conversation.
BROWSER_NEW_CONVERSATION = os.getenv("BROWSER_NEW_CONVERSATION", "true").strip().lower() not in {"0", "false", "no"}

# Shared secret required from the Nankai agent when it calls the local /api/genios/* tools.
GENIOS_TOOL_TOKEN = os.getenv("GENIOS_TOOL_TOKEN", "")

OPENALEX_EMAIL = os.getenv("OPENALEX_EMAIL", "")
