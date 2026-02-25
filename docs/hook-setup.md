# Hook Setup Guide

This guide explains how to configure your projects so that Claude Code and Gemini CLI send observability events to the dashboard server.

## Prerequisites

- **uv** — Python package runner ([install](https://docs.astral.sh/uv/getting-started/installation/))
- **Observability server** running at `http://localhost:4000` (or set `OBSERVABILITY_SERVER_URL`)

## How It Works

Both Claude Code and Gemini CLI support **hooks** — shell commands that run at specific points in the agent lifecycle. Each hook script reads JSON context from stdin, extracts key fields (`session_id`, `tool_name`, etc.), and POSTs an event to the observability server.

The server identifies agents by `source_app` + `session_id`. Claude Code events arrive with `source_app: "claude-code"`, Gemini CLI events with `source_app: "gemini-cli"`. Both appear side-by-side on the dashboard.

## Claude Code

### Option A: Copy the hooks directory (recommended for other projects)

1. Copy the `.claude/hooks/` directory from this repo into your project:

```bash
cp -r /path/to/claude-observability/.claude/hooks/ /path/to/your-project/.claude/hooks/
```

2. Copy the settings file:

```bash
cp /path/to/claude-observability/.claude/settings.json /path/to/your-project/.claude/settings.json
```

If your project already has a `.claude/settings.json`, merge the `"hooks"` key into it.

### Option B: Symlink (for development)

```bash
ln -s /path/to/claude-observability/.claude/hooks /path/to/your-project/.claude/hooks
```

### Configuration format

Claude Code hooks are configured in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "uv run --script \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/pre_tool_use.py"
          }
        ]
      }
    ]
  }
}
```

- `$CLAUDE_PROJECT_DIR` is set by Claude Code to the project root
- No `matcher` field needed — Claude hooks fire for all events of that type by default

### Supported events

| Hook Event | Script | Description |
|---|---|---|
| `SessionStart` | `session_start.py` | Agent session begins |
| `SessionEnd` | `session_end.py` | Agent session ends + transcript ingestion |
| `PreToolUse` | `pre_tool_use.py` | Before tool execution (includes safety checks) |
| `PostToolUse` | `post_tool_use.py` | After tool execution |
| `PostToolUseFailure` | `post_tool_use_failure.py` | Tool execution failed |
| `UserPromptSubmit` | `user_prompt_submit.py` | User submits a prompt |
| `Stop` | `stop.py` | Agent loop completes |
| `Notification` | `notification.py` | Agent sends a notification |
| `PreCompact` | `pre_compact.py` | Context compaction triggered |
| `SubagentStart` | `subagent_start.py` | Sub-agent spawned |
| `SubagentStop` | `subagent_stop.py` | Sub-agent finished |
| `PermissionRequest` | `permission_request.py` | Agent requests permission |
| `TeammateIdle` | `teammate_idle.py` | Teammate agent goes idle |
| `TaskCompleted` | `task_completed.py` | Agent completes a task |

## Gemini CLI

### Option A: Copy the hooks directory

1. Copy the `.gemini/hooks/` directory from this repo into your project:

```bash
cp -r /path/to/claude-observability/.gemini/hooks/ /path/to/your-project/.gemini/hooks/
```

2. Copy the settings file:

```bash
cp /path/to/claude-observability/.gemini/settings.json /path/to/your-project/.gemini/settings.json
```

If your project already has a `.gemini/settings.json`, merge the `"hooks"` key into it.

### Configuration format

Gemini CLI hooks are configured in `.gemini/settings.json`:

```json
{
  "hooks": {
    "BeforeTool": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "uv run --script $GEMINI_PROJECT_DIR/.gemini/hooks/before_tool.py"
          }
        ]
      }
    ]
  }
}
```

- `$GEMINI_PROJECT_DIR` is set by Gemini CLI to the project root
- Tool hooks (`BeforeTool`, `AfterTool`) use `"matcher": ".*"` (regex) to match all tools
- Lifecycle hooks use `"matcher": "*"` (exact match wildcard) to match all triggers

### Event mapping

Gemini CLI uses different event names than the server. The hook scripts translate them:

| Gemini Event | Server Event | Script | Description |
|---|---|---|---|
| `SessionStart` | `SessionStart` | `session_start.py` | Agent session begins |
| `SessionEnd` | `SessionEnd` | `session_end.py` | Agent session ends |
| `BeforeTool` | `PreToolUse` | `before_tool.py` | Before tool execution |
| `AfterTool` | `PostToolUse` | `after_tool.py` | After tool execution |
| `BeforeAgent` | `UserPromptSubmit` | `before_agent.py` | User prompt submitted |
| `AfterAgent` | `Stop` | `after_agent.py` | Agent loop completes |
| `Notification` | `Notification` | `notification.py` | Agent notification |
| `PreCompress` | `PreCompact` | `pre_compress.py` | Context compression triggered |

### Limitations

- **No transcript ingestion** — Gemini CLI transcript format differs from Claude Code. The `SessionEnd` hook sends the event but does not ingest the transcript. Transcripts tab will not show Gemini sessions.
- **No safety gate** — Claude Code's `pre_tool_use.py` includes safety checks (blocking `rm -rf /`, `.env` access). The Gemini `before_tool.py` does not include these since Gemini CLI has its own permission model.

## Custom server URL

By default, hooks POST to `http://localhost:4000`. To use a different server, set the `OBSERVABILITY_SERVER_URL` environment variable:

```bash
export OBSERVABILITY_SERVER_URL=http://192.168.1.100:4000
```

## Verifying the setup

1. Start the observability server:

```bash
cd /path/to/claude-observability
cd apps/server && bun run dev
```

2. Start the dashboard:

```bash
cd apps/client && bun run dev
```

3. Open the dashboard at `http://localhost:5173`

4. Run Claude Code or Gemini CLI in a project with hooks configured. Events should appear in the Live tab within seconds.

5. Check the filter dropdown — you should see `claude-code` and/or `gemini-cli` as source apps.

## Troubleshooting

**No events appearing:**
- Verify the server is running on port 4000
- Check that `uv` is on your PATH: `which uv`
- Test a hook manually: `echo '{"session_id":"test"}' | uv run --script .claude/hooks/session_start.py`
- Check server logs for incoming POST requests

**Gemini hooks not firing:**
- Ensure Gemini CLI v0.26.0+ is installed: `gemini --version`
- Verify `.gemini/settings.json` is valid JSON: `python -c "import json; json.load(open('.gemini/settings.json'))"`
- Check that `$GEMINI_PROJECT_DIR` resolves correctly — try running a hook command manually from the project root

**Claude hooks not firing:**
- Verify `.claude/settings.json` is valid JSON
- Check that `$CLAUDE_PROJECT_DIR` resolves correctly
- Look for error output in the Claude Code terminal
