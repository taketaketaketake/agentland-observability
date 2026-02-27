#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests"]
# ///
"""Shared helper: POST a hook event to the observability server."""

import json
import os
import sys
import requests

SERVER_URL = os.environ.get("OBSERVABILITY_SERVER_URL", "http://localhost:4000")


def get_source_app(cwd: str | None = None) -> str:
    """Derive source_app from CLAUDE_SOURCE_APP env var or cwd folder name."""
    env_val = os.environ.get("CLAUDE_SOURCE_APP")
    if env_val:
        return env_val
    path = cwd or os.getcwd()
    return os.path.basename(path.rstrip("/\\")) or "claude-code"


def send_event(hook_event_type: str, extra: dict | None = None) -> None:
    """Read hook data from stdin and POST it to the server."""
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            return

        data = json.loads(raw)
    except (json.JSONDecodeError, Exception):
        return

    session_id = data.get("session_id", "unknown")
    source_app = get_source_app(data.get("cwd"))

    payload = data if isinstance(data, dict) else {"raw": data}

    event = {
        "source_app": source_app,
        "session_id": session_id,
        "hook_event_type": hook_event_type,
        "payload": payload,
        "timestamp": None,  # server will set it
    }

    # Merge any extra fields
    if extra:
        event.update(extra)

    try:
        requests.post(
            f"{SERVER_URL}/events",
            json=event,
            timeout=2,
        )
    except Exception:
        pass  # Don't block the agent if the server is down


if __name__ == "__main__":
    # When run directly, expect hook_event_type as first arg
    event_type = sys.argv[1] if len(sys.argv) > 1 else "Unknown"
    send_event(event_type)
