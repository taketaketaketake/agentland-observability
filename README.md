# Claude Code Observability

Real-time observability dashboard for multi-agent Claude Code sessions. Captures hook events, streams them over WebSocket, and displays them in a live mission-control UI with agent tracking, transcript viewing, and analytics.

## What This Is

When you run Claude Code, it fires lifecycle hooks (tool use, session start/end, permissions, etc.). This system captures those hooks, stores them in SQLite, and streams them to a React dashboard in real time. You get:

- **Live event feed** with per-agent color coding and swim lanes
- **Agent status panel** showing active/idle/stopped agents
- **Session transcripts** ingested at session end, viewable from multiple entry points
- **Human-in-the-loop support** for responding to agent questions from the dashboard
- **Insights dashboard** with KPIs, event breakdowns, and tool usage charts

## Documentation Relationship Map

```
                        ┌───────────────────────┐
                        │      CLAUDE.md        │
                        │  (Project rules +     │
                        │   agent identity)     │
                        └───────────┬───────────┘
                                    │
                ┌───────────────────┼───────────────────┐
                │                   │                   │
    ┌───────────▼──────────┐  ┌────▼──────────┐  ┌─────▼─────────────┐
    │     README.md        │  │  docs/        │  │  .claude/         │
    │                      │  │  architecture │  │  hooks/ + settings│
    │  - Entry point       │  │  .md          │  │                   │
    │  - Quick start       │  │               │  │  - Hook scripts   │
    │  - Repo structure    │  │  - Layers     │  │  - Event wiring   │
    └──────────────────────┘  │  - Data flow  │  │  - Safety gates   │
                              │  - Schema     │  └───────────────────┘
                              └───────────────┘
```

## Repository Structure

```
.
├── .claude/                          # Claude Code hook system
│   ├── settings.json                 # Hook event → script wiring
│   └── hooks/                        # Python hook scripts
│       ├── send_event.py             # Shared helper: POST event to server
│       ├── pre_tool_use.py           # Safety gate (blocks rm -rf, .env access)
│       ├── post_tool_use.py          # Logs tool completion
│       ├── post_tool_use_failure.py  # Logs tool failures
│       ├── session_start.py          # Sends SessionStart event
│       ├── session_end.py            # Sends SessionEnd + ingests transcript JSONL
│       ├── stop.py                   # Sends Stop event
│       ├── subagent_start.py         # Logs subagent spawn
│       ├── subagent_stop.py          # Logs subagent termination
│       ├── user_prompt_submit.py     # Logs user prompts
│       ├── permission_request.py     # Logs permission requests
│       ├── notification.py           # Logs notifications
│       ├── config_change.py          # Logs config changes
│       ├── pre_compact.py            # Logs context compaction
│       ├── teammate_idle.py          # Logs idle agents
│       ├── task_completed.py         # Logs task completion
│       └── validators/               # Additional validation modules
│
├── apps/
│   ├── server/                       # Bun + SQLite backend
│   │   └── src/
│   │       ├── index.ts              # HTTP routes + WebSocket server
│   │       ├── db.ts                 # SQLite schema, queries, WAL mode
│   │       └── types.ts              # Shared TypeScript interfaces
│   │
│   └── client/                       # React 19 + Vite + Tailwind dashboard
│       └── src/
│           ├── App.tsx               # Main layout (Live / Insights / Transcripts tabs)
│           ├── config.ts             # WS_URL, API_URL, MAX_EVENTS
│           ├── types.ts              # Client-side TypeScript interfaces
│           ├── components/           # UI components
│           ├── hooks/                # Custom React hooks
│           └── utils/                # Event summaries, chart helpers
│
├── scripts/                          # System start/stop scripts
│   ├── start-system.sh
│   └── reset-system.sh
│
├── docs/
│   └── architecture.md               # System architecture specification
│
├── justfile                          # Task runner recipes
├── .env.sample                       # Environment variable template
└── CLAUDE.md                         # AI assistant context and rules
```

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (server runtime + SQLite)
- [Node.js](https://nodejs.org/) 18+ (client build)
- [uv](https://github.com/astral-sh/uv) (Python script runner for hooks)
- [just](https://github.com/casey/just) (optional, task runner)

### Install

```bash
just install
# or manually:
cd apps/server && bun install
cd apps/client && npm install
```

### Run

```bash
# Start both server and client
just start

# Or separately:
just server   # http://localhost:4000
just client   # http://localhost:5173
```

### Configure Hooks

The `.claude/settings.json` is already committed to this repo with portable paths using `$CLAUDE_PROJECT_DIR`. Just clone the repo and ensure `uv` is on your PATH — hooks will resolve automatically. All hook scripts POST events to `http://localhost:4000/events` (configurable via `OBSERVABILITY_SERVER_URL`).

### Test

```bash
# Send a test event
just test-event

# Open the dashboard
just open
```

## Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Hooks** | Python 3.10+ / uv | Event emission from Claude Code |
| **Server** | Bun + SQLite (WAL) | HTTP + WebSocket server, event storage |
| **Client** | React 19 + TypeScript + Vite | Dashboard UI |
| **Styling** | Tailwind CSS v3 | Dark industrial theme |
| **Charts** | SVG (zero deps) | Data visualization |
| **Transport** | WebSocket | Real-time event streaming |

## Environment Variables

```bash
SERVER_PORT=4000                              # Server HTTP/WS port
CLIENT_PORT=5173                              # Vite dev server port
OBSERVABILITY_SERVER_URL=http://localhost:4000 # Hook target URL
VITE_WS_URL=ws://localhost:4000/stream        # Client WebSocket URL
VITE_API_URL=http://localhost:4000            # Client API URL
VITE_MAX_EVENTS_TO_DISPLAY=300                # Max events in UI buffer
```

## Learn More

See [docs/architecture.md](docs/architecture.md) for the full system architecture, data flow, and database schema.
