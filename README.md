# AgentLand Observability

A real-time dashboard that lets you watch what your AI coding agents are doing as they work.

Python hook scripts capture lifecycle events from Claude Code and Gemini CLI, a Bun server stores them in SQLite and broadcasts over WebSocket, and a React dashboard displays everything in real time. Includes session transcript viewing, analytics, and an LLM-powered evaluation system that scores agent quality.

Read the full explanation of how everything works in [docs/about.md](docs/about.md).

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (runtime for server + client)
- [uv](https://github.com/astral-sh/uv) (Python script runner for hooks)
- [just](https://github.com/casey/just) (optional, task runner)

### Install

```bash
just install
# or manually:
cd apps/server && bun install
cd apps/client && bun install
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

Hook configurations for both Claude Code (`.claude/settings.json`) and Gemini CLI (`.gemini/settings.json`) are committed to this repo with portable paths. Just clone the repo and ensure `uv` is on your PATH — hooks will resolve automatically.

To add observability to **other projects**, run the setup script from your target project:

```bash
cd /path/to/your-project
/path/to/agentland-observability/scripts/setup-hooks.sh

# Or with just (from this repo):
just setup-hooks /path/to/your-project

# Non-interactive (for CI):
scripts/setup-hooks.sh /path/to/your-project --all
scripts/setup-hooks.sh /path/to/your-project --claude
scripts/setup-hooks.sh /path/to/your-project --gemini
```

The script copies hook scripts and merges `settings.json` non-destructively (preserving existing settings). See [docs/hook-setup.md](docs/hook-setup.md) for manual setup and details.

All hook scripts POST events to `http://localhost:4000/events` (configurable via `OBSERVABILITY_SERVER_URL`).

### Test

```bash
# Run server unit + integration tests (Bun test, 31 tests)
just test

# Run browser e2e tests (Playwright + Chromium)
just test-e2e

# Run everything
just test-all

# Send a manual test event
just test-event

# Open the dashboard
just open
```

### LLM Evaluation Setup (Optional)

To use the LLM-powered evaluators (Transcript Quality and Reasoning Quality), set an API key:

```bash
# Use Anthropic (auto-detected)
export ANTHROPIC_API_KEY=sk-ant-...

# Use Gemini (auto-detected)
export GOOGLE_API_KEY=AI...

# Both keys set — force one explicitly
export EVAL_PROVIDER=gemini

# Override the model for any provider
export EVAL_MODEL=gemini-2.5-pro
```

The Tool Success and Regression Detection evaluators work without any API key.

## The Stack

Everything is deliberately lightweight:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Hooks** | Python 3.10+ / uv | Event capture from Claude Code + Gemini CLI |
| **Server** | Bun + SQLite (WAL) | HTTP + WebSocket server, event storage |
| **Client** | React 19 + TypeScript + Vite | Dashboard UI |
| **Styling** | Tailwind CSS v3 | Dark industrial theme |
| **Charts** | SVG (zero deps) | Data visualization with no chart libraries |
| **Transport** | WebSocket | Real-time event streaming |
| **Evaluations** | Anthropic / Gemini (pluggable) | LLM-as-judge for quality scoring |
| **Testing** | Bun test + Playwright | Server integration + browser e2e tests |

No Docker, no cloud services, no external databases. It all runs locally on your machine.

## Repository Structure

```
.
├── .claude/                          # Claude Code hook system
│   ├── settings.json                 # Hook event → script wiring
│   └── hooks/                        # Python hook scripts (14 events)
│       ├── send_event.py             # Shared helper: POST event to server
│       ├── pre_tool_use.py           # Safety gate (blocks rm -rf, .env access)
│       ├── post_tool_use.py          # Logs tool completion
│       ├── session_end.py            # Sends SessionEnd + ingests transcript JSONL
│       └── ...                       # session_start, stop, notification, etc.
│
├── .gemini/                          # Gemini CLI hook system
│   ├── settings.json                 # Hook event → script wiring (with matchers)
│   └── hooks/                        # Python hook scripts (8 events)
│       ├── send_event.py             # Shared helper (source_app: "gemini-cli")
│       ├── before_tool.py            # BeforeTool → PreToolUse
│       ├── after_tool.py             # AfterTool → PostToolUse
│       └── ...                       # session_start/end, before/after_agent, etc.
│
├── apps/
│   ├── server/                       # Bun + SQLite backend
│   │   ├── tests/                    # Bun test suite (DB + API + WebSocket)
│   │   └── src/
│   │       ├── index.ts              # HTTP routes + WebSocket server
│   │       ├── db.ts                 # SQLite schema, queries, WAL mode
│   │       ├── types.ts              # Shared TypeScript interfaces
│   │       ├── evaluations.ts        # Evaluation CRUD (runs, results, baselines)
│   │       ├── evaluationRunner.ts   # Evaluator orchestration + progress broadcast
│   │       └── evaluators/           # Pluggable evaluator modules
│   │           ├── types.ts          # Evaluator interface
│   │           ├── llmProvider.ts    # Multi-provider LLM abstraction
│   │           ├── toolSuccess.ts    # Tool success/failure rate (no API key)
│   │           ├── transcriptQuality.ts  # LLM judge: input + response quality
│   │           ├── reasoningQuality.ts   # LLM judge: thinking depth/coherence
│   │           └── regression.ts     # Statistical z-score regression detection
│   │
│   └── client/                       # React 19 + Vite + Tailwind dashboard
│       ├── e2e/                      # Playwright browser tests
│       └── src/
│           ├── App.tsx               # Main layout (Live / Insights / Transcripts / Evals)
│           ├── config.ts             # WS_URL, API_URL, MAX_EVENTS
│           ├── types.ts              # Client-side TypeScript interfaces
│           ├── components/           # UI components
│           ├── hooks/                # Custom React hooks
│           └── utils/                # Event summaries, chart helpers
│
├── scripts/                          # Setup and management scripts
│   ├── setup-hooks.sh               # Install hooks in other projects
│   ├── start-system.sh
│   └── reset-system.sh
│
├── docs/
│   ├── architecture.md               # Full system architecture and data flow
│   └── hook-setup.md                 # Hook setup guide for Claude Code + Gemini CLI
│
├── justfile                          # Task runner recipes
├── .env.sample                       # Environment variable template
└── CLAUDE.md                         # AI assistant context and rules
```

## Environment Variables

```bash
# Core
SERVER_PORT=4000                              # Server HTTP/WS port
CLIENT_PORT=5173                              # Vite dev server port
OBSERVABILITY_SERVER_URL=http://localhost:4000 # Hook target URL
VITE_WS_URL=ws://localhost:4000/stream        # Client WebSocket URL
VITE_API_URL=http://localhost:4000            # Client API URL
VITE_MAX_EVENTS_TO_DISPLAY=300                # Max events in UI buffer

# LLM Evaluations (optional — set one or both)
ANTHROPIC_API_KEY=sk-ant-...                  # Enables Anthropic provider
GOOGLE_API_KEY=AI...                          # Enables Gemini provider
EVAL_PROVIDER=                                # Force provider: anthropic | gemini
EVAL_MODEL=                                   # Override default model
```

## Learn More

- [docs/about.md](docs/about.md) — Detailed plain-English explanation of what this is and how it works
- [docs/architecture.md](docs/architecture.md) — Full system architecture, data flow, and database schema
- [docs/hook-setup.md](docs/hook-setup.md) — Configuring hooks in your projects
