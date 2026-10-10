"""Fail if a secret from .env leaked into a tracked file or if .env got committed.

Run before pushing:

    .venv\\Scripts\\python.exe backend\\scripts\\check_secrets.py

It reads the real secret values from .env locally and searches every git-tracked
file for them. Secret values themselves are never printed.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = ROOT / ".env"
SENSITIVE_KEYS = ("GENIOS_API_KEY", "LLM_API_KEY", "GENIOS_TOOL_TOKEN")


def read_secrets() -> dict[str, str]:
    secrets: dict[str, str] = {}
    if not ENV_PATH.exists():
        return secrets
    for raw in ENV_PATH.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key in SENSITIVE_KEYS and len(value) >= 8:
            secrets[key] = value
    return secrets


def tracked_files() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=False
    )
    if result.returncode != 0:
        print("Could not run `git ls-files`; run this from inside the repository.")
        raise SystemExit(2)
    return [item for item in result.stdout.decode("utf-8", "replace").split("\0") if item]


def main() -> int:
    problems: list[str] = []
    tracked = tracked_files()

    if ".env" in tracked:
        problems.append(".env is tracked by git - remove it with `git rm --cached .env`.")

    secrets = read_secrets()
    if not secrets:
        print("No non-empty secrets found in .env; nothing to scan.")
    else:
        print(f"Scanning {len(tracked)} tracked files for {len(secrets)} non-empty secret(s)...")
        for name in secrets:
            value = secrets[name]
            for relative in tracked:
                path = ROOT / relative
                try:
                    body = path.read_text(encoding="utf-8", errors="ignore")
                except OSError:
                    continue
                if value in body:
                    problems.append(f"{name} leaked into tracked file: {relative}")

    if problems:
        print("\nSECRET LEAK CHECK FAILED:")
        for item in problems:
            print(f"  - {item}")
        print("\nRotate/revoke the exposed key on the platform, then remove it from the file and history.")
        return 1

    print("OK: no .env secret found in tracked files, and .env is not tracked.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
