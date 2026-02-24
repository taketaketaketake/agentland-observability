#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests"]
# ///
"""PreToolUse hook: validate tool calls and send event."""

import json
import os
import sys
import requests

SERVER_URL = os.environ.get("OBSERVABILITY_SERVER_URL", "http://localhost:4000")


def main() -> None:
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            return
        data = json.loads(raw)
    except (json.JSONDecodeError, Exception):
        return

    session_id = data.get("session_id", "unknown")
    source_app = os.environ.get("CLAUDE_SOURCE_APP", "claude-code")
    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {})

    # --- Safety checks ---
    # Block dangerous rm -rf commands
    if tool_name == "Bash":
        command = tool_input.get("command", "")
        if "rm -rf /" in command or "rm -rf ~" in command:
            # Deny the tool call
            result = {
                "decision": "block",
                "reason": "Blocked dangerous rm -rf command",
            }
            print(json.dumps(result))
            return

    # Block .env file access
    if tool_name in ("Read", "Write", "Edit"):
        file_path = tool_input.get("file_path", "")
        if ".env" in file_path and not file_path.endswith(".env.sample"):
            result = {
                "decision": "block",
                "reason": "Blocked access to .env file",
            }
            print(json.dumps(result))
            return

    # --- Send event to observability server ---
    event = {
        "source_app": source_app,
        "session_id": session_id,
        "hook_event_type": "PreToolUse",
        "payload": {
            "tool_name": tool_name,
            "tool_input": tool_input,
        },
    }

    try:
        requests.post(f"{SERVER_URL}/events", json=event, timeout=2)
    except Exception:
        pass


if __name__ == "__main__":
    main()
