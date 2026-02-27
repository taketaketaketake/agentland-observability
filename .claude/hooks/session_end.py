#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests"]
# ///
"""SessionEnd hook — sends event and ingests session transcript."""
import json
import os
import sys
import traceback

import requests

SERVER_URL = os.environ.get("OBSERVABILITY_SERVER_URL", "http://localhost:4000")

LOG_FILE = os.path.expanduser("~/.claude/session_end_hook.log")


def log(msg: str) -> None:
    """Write to both stderr and a persistent log file."""
    line = f"[session_end] {msg}"
    print(line, file=sys.stderr)
    try:
        with open(LOG_FILE, "a") as f:
            from datetime import datetime, timezone
            ts = datetime.now(timezone.utc).isoformat()
            f.write(f"{ts} {line}\n")
    except Exception:
        pass


def send_event_inline(data: dict, session_id: str, source_app: str) -> None:
    """Send the SessionEnd event to the server."""
    payload = data if isinstance(data, dict) else {"raw": data}
    event = {
        "source_app": source_app,
        "session_id": session_id,
        "hook_event_type": "SessionEnd",
        "payload": payload,
        "timestamp": None,
    }
    try:
        resp = requests.post(f"{SERVER_URL}/events", json=event, timeout=2)
        log(f"SessionEnd event POST: {resp.status_code}")
    except Exception as e:
        log(f"SessionEnd event POST failed: {e}")


def ingest_transcript(session_id: str, source_app: str, cwd: str, transcript_path: str | None = None) -> None:
    """Read the .jsonl transcript and POST messages to /transcripts."""
    if transcript_path and os.path.exists(transcript_path):
        jsonl_path = transcript_path
        log(f"Using transcript_path from stdin: {jsonl_path}")
    else:
        # Fallback: construct the path (Claude replaces both / and _ with -)
        cwd_dashed = cwd.translate(str.maketrans("/_", "--"))
        jsonl_path = os.path.expanduser(f"~/.claude/projects/{cwd_dashed}/{session_id}.jsonl")
        log(f"Constructed transcript path: {jsonl_path}")
        log(f"  cwd={cwd!r} -> cwd_dashed={cwd_dashed!r}")

    log(f"  session_id={session_id!r}")

    if not os.path.exists(jsonl_path):
        log(f"File NOT FOUND: {jsonl_path}")
        # List what's actually in the directory to debug
        parent = os.path.dirname(jsonl_path)
        if os.path.isdir(parent):
            files = [f for f in os.listdir(parent) if f.endswith(".jsonl")]
            log(f"  Directory {parent} has {len(files)} .jsonl files")
            # Show a few filenames to help debug
            for f in files[:5]:
                log(f"    {f}")
        else:
            log(f"  Parent directory does not exist: {parent}")
        return

    file_size = os.path.getsize(jsonl_path)
    log(f"File found: {jsonl_path} ({file_size} bytes)")

    total_lines = 0
    user_msgs = 0
    assistant_msgs = 0
    skipped_no_content = 0
    parse_errors = 0
    messages = []
    # Buffer for thinking-only assistant records to merge into the next text response
    pending_thinking: list[str] = []

    try:
        with open(jsonl_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                total_lines += 1
                try:
                    record = json.loads(line)
                except json.JSONDecodeError as e:
                    parse_errors += 1
                    if parse_errors <= 3:
                        log(f"  JSON parse error on line {total_lines}: {e}")
                    continue

                record_type = record.get("type")
                if record_type not in ("user", "assistant"):
                    continue

                msg = record.get("message", {})
                role = msg.get("role")
                if role not in ("user", "assistant"):
                    continue

                uuid = record.get("uuid")
                timestamp = record.get("timestamp")
                if not uuid or not timestamp:
                    continue

                # Extract text content
                raw_content = msg.get("content", "")
                text_parts = []
                thinking_parts = []

                if isinstance(raw_content, str):
                    text_parts.append(raw_content)
                elif isinstance(raw_content, list):
                    for block in raw_content:
                        if isinstance(block, dict):
                            if block.get("type") == "text":
                                text_parts.append(block.get("text", ""))
                            elif block.get("type") == "thinking":
                                thinking_parts.append(block.get("thinking", ""))
                        elif isinstance(block, str):
                            text_parts.append(block)

                content = "\n\n".join(text_parts).strip()
                thinking = "\n\n".join(thinking_parts).strip() or None

                if not content and not thinking:
                    skipped_no_content += 1
                    continue

                # Thinking-only assistant record: buffer it for the next text response
                if role == "assistant" and thinking and not content:
                    pending_thinking.append(thinking)
                    continue

                # Merge any buffered thinking into this assistant message
                if role == "assistant" and pending_thinking:
                    merged = "\n\n".join(pending_thinking)
                    if thinking:
                        thinking = merged + "\n\n" + thinking
                    else:
                        thinking = merged
                    pending_thinking.clear()

                message_data = {
                    "session_id": session_id,
                    "source_app": source_app,
                    "role": role,
                    "content": content,
                    "thinking": thinking,
                    "model": msg.get("model") if role == "assistant" else None,
                    "timestamp": timestamp,
                    "uuid": uuid,
                }

                # Token usage (assistant only)
                usage = msg.get("usage", {})
                if role == "assistant" and usage:
                    message_data["input_tokens"] = usage.get("input_tokens")
                    message_data["output_tokens"] = usage.get("output_tokens")

                messages.append(message_data)
                if role == "user":
                    user_msgs += 1
                else:
                    assistant_msgs += 1

    except Exception as e:
        log(f"Error reading transcript: {e}\n{traceback.format_exc()}")
        return

    log(f"Parsed: {total_lines} lines, {user_msgs} user msgs, {assistant_msgs} assistant msgs, {skipped_no_content} skipped (no content), {parse_errors} parse errors")

    if not messages:
        log("No messages to send — skipping POST")
        return

    try:
        resp = requests.post(
            f"{SERVER_URL}/transcripts",
            json={"messages": messages},
            timeout=10,
        )
        log(f"POST /transcripts: {resp.status_code} — {resp.text[:200]}")
    except Exception as e:
        log(f"POST /transcripts failed: {e}")


if __name__ == "__main__":
    log("=== Hook started ===")
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            log("Empty stdin — exiting")
            sys.exit(0)
        data = json.loads(raw)
        log(f"stdin keys: {list(data.keys())}")
    except (json.JSONDecodeError, Exception) as e:
        log(f"Failed to parse stdin: {e}")
        sys.exit(0)

    session_id = data.get("session_id", "unknown")
    from send_event import get_source_app
    source_app = get_source_app(cwd)
    cwd = data.get("cwd", os.getcwd())
    transcript_path = data.get("transcript_path")

    log(f"session_id={session_id}, source_app={source_app}, cwd={cwd}")
    log(f"transcript_path={transcript_path!r}")

    # 1. Send the SessionEnd event
    send_event_inline(data, session_id, source_app)

    # 2. Ingest the transcript
    ingest_transcript(session_id, source_app, cwd, transcript_path)

    log("=== Hook finished ===")
