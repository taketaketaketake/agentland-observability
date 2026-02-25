# Multi-Agent Observability

Real-time observability dashboard for multi-agent coding sessions. Supports **Claude Code** and **Gemini CLI**. Captures hook events, streams them over WebSocket, and displays them in a live mission-control UI with agent tracking, transcript viewing, analytics, and LLM-powered evaluation.

## What This Is

When you run Claude Code or Gemini CLI, they fire lifecycle hooks (tool use, session start/end, permissions, etc.). This system captures those hooks, stores them in SQLite, and streams them to a React dashboard in real time. Agents from both tools appear side-by-side, identified by `source_app` (`claude-code` or `gemini-cli`) + `session_id`. You get:

- **Live event feed** with per-agent color coding and swim lanes
- **Agent status panel** showing active/idle/stopped agents
- **Session transcripts** ingested at session end, viewable from multiple entry points
- **Human-in-the-loop support** for responding to agent questions from the dashboard
- **Insights dashboard** with KPIs, event breakdowns, and tool usage charts
- **LLM evaluation system** for scoring agent quality across tool success, transcript quality, reasoning quality, and regression detection

## Documentation Relationship Map

```
                        ┌───────────────────────┐
                        │      CLAUDE.md        │
                        │  (Project rules +     │
                        │   agent identity)     │
                        └───────────┬───────────┘
                                    │
        ┌───────────────────┬───────┴───────┬───────────────────┐
        │                   │               │                   │
┌───────▼──────────┐  ┌────▼──────────┐  ┌─▼────────────────┐  ┌▼──────────────────┐
│    README.md     │  │  docs/        │  │  .claude/        │  │  .gemini/          │
│                  │  │  architecture │  │  hooks/ + settings│  │  hooks/ + settings │
│  - Entry point   │  │  .md          │  │                  │  │                    │
│  - Quick start   │  │  hook-setup   │  │  - Hook scripts  │  │  - Hook scripts    │
│  - Repo structure│  │  .md          │  │  - Event wiring  │  │  - Event mapping   │
└──────────────────┘  │               │  │  - Safety gates  │  │  - Gemini config   │
                      │  - Layers     │  └──────────────────┘  └────────────────────┘
                      │  - Data flow  │
                      │  - Schema     │
                      └───────────────┘
```

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
│   │           ├── llmProvider.ts    # Multi-provider LLM abstraction (Anthropic, Gemini)
│   │           ├── toolSuccess.ts    # Tool success/failure rate (no API key)
│   │           ├── transcriptQuality.ts  # LLM judge: input quality + response quality (v2)
│   │           ├── reasoningQuality.ts   # LLM judge: depth/coherence/self-correction
│   │           └── regression.ts     # Statistical z-score regression detection
│   │
│   └── client/                       # React 19 + Vite + Tailwind dashboard
│       ├── e2e/                      # Playwright browser tests
│       ├── playwright.config.ts      # Playwright config (ports 4444/5174)
│       └── src/
│           ├── App.tsx               # Main layout (Live / Insights / Transcripts / Evals)
│           ├── config.ts             # WS_URL, API_URL, MAX_EVENTS
│           ├── types.ts              # Client-side TypeScript interfaces
│           ├── components/           # UI components
│           │   ├── EvaluationsPanel.tsx     # Evals tab: KPIs, evaluator cards, run history
│           │   ├── EvalRunDetailPanel.tsx   # Drill-down into scored results + rationale
│           │   └── charts/
│           │       ├── SuccessRateChart.tsx       # Stacked bars for tool success/failure
│           │       └── ScoreDistributionChart.tsx # Horizontal bars for 1-5 score dimensions
│           ├── hooks/                # Custom React hooks
│           │   └── useEvaluations.ts # Eval state management + WebSocket progress
│           └── utils/                # Event summaries, chart helpers
│
├── scripts/                          # System start/stop scripts
│   ├── start-system.sh
│   └── reset-system.sh
│
├── docs/
│   ├── architecture.md               # System architecture specification
│   └── hook-setup.md                 # Hook setup guide for Claude Code + Gemini CLI
│
├── justfile                          # Task runner recipes
├── .env.sample                       # Environment variable template
└── CLAUDE.md                         # AI assistant context and rules
```

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

To add observability to **other projects**, copy the `.claude/hooks/` and/or `.gemini/hooks/` directories plus their `settings.json` files. See [docs/hook-setup.md](docs/hook-setup.md) for detailed instructions.

All hook scripts POST events to `http://localhost:4000/events` (configurable via `OBSERVABILITY_SERVER_URL`).

### Test

```bash
# Run server unit + integration tests (Bun test, 31 tests)
just test

# Run browser e2e tests (Playwright + Chromium, 5 tests)
just test-e2e

# Run everything
just test-all

# Send a manual test event
just test-event

# Open the dashboard
just open
```

The server tests use in-memory SQLite for DB tests and a real server on a random port for API tests. The Playwright tests spin up dedicated server (port 4444) and client (port 5174) instances with a temporary DB to avoid collisions with dev servers.

## Evaluation System

The Evals tab lets you assess agent quality on-demand. A scope filter bar lets you narrow evaluations by time range, project, and session. Click "Run" on any evaluator card to score the filtered data.

### Evaluators

| Evaluator | What it measures | LLM provider needed | Cost |
|-----------|-----------------|---------------------|------|
| **Tool Success** | Success/failure rate per tool and agent | No | Zero (pure logic) |
| **Transcript Quality** | User input clarity/context + assistant helpfulness/accuracy/conciseness (1-5 each) | Yes | LLM calls |
| **Reasoning Quality** | Thinking depth, coherence, self-correction (1-5 each) | Yes | LLM calls |
| **Regression Detection** | Z-score comparison of current vs baseline metrics | No | Zero (statistics) |

### How it works

```
User clicks "Run"  →  POST /evaluations/run  →  Server runs evaluator async
                                                  │
                   WebSocket progress ◄────────────┤
                   (real-time bar updates)         │
                                                   ▼
                   Results stored in SQLite  →  GET /evaluations/runs/:id/results
```

- **Tool success** scans `PostToolUse`/`PostToolUseFailure` events and computes rates grouped by tool name and agent
- **Transcript quality** uses stratified sampling across sessions, then sends each (user message, assistant response) pair to an LLM judge that scores both user input quality (clarity, context) and assistant response quality (helpfulness, accuracy, conciseness)
- **Reasoning quality** evaluates thinking blocks (extracted during transcript ingestion, including merged thinking-only records) with the same stratified sampling approach
- **Regression** compares a baseline window (7 days ago → 24h ago) against the current window (last 24h) using z-score tests. Flags metrics with z < -2.0 (degraded) or z > 2.0 (improved)

LLM evaluators use `temperature: 0` for deterministic scoring. Prompt versions are tracked so regression detection only compares results from matching prompt versions.

### LLM Providers

The evaluation system supports multiple LLM providers for judge calls. Set one API key and the system auto-detects the provider, or use `EVAL_PROVIDER` to choose explicitly.

| Provider | API Key Env Var | Default Model |
|----------|----------------|---------------|
| **Anthropic** | `ANTHROPIC_API_KEY` | `claude-sonnet-4-20250514` |
| **Gemini** | `GOOGLE_API_KEY` | `gemini-2.5-flash` |

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

The `/evaluations/config` endpoint reports which providers are configured.

### Scope Filters

The filter bar at the top of the Evals tab controls what data each evaluator sees:

| Filter | Options | Effect |
|--------|---------|--------|
| **Time Range** | 24 hours, 7 days, 30 days, All time | Sets `time_window_hours` (or omits it for all time) |
| **Project** | All Projects, or a specific project | Filters events/messages by `cwd` prefix match |
| **Session** | All Sessions, Last Session, or a specific session | Scopes evaluation to a single session |

Projects are auto-detected from event `payload.cwd` fields, deduplicated by shared git root (e.g. `client/` and `server/` subdirectories merge under the parent project). Sessions display the first user message as a readable label.

### Evaluation API

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/evaluations/run` | Start an evaluation (returns 202) |
| GET | `/evaluations/runs` | List runs (filterable by type/status) |
| GET | `/evaluations/runs/:id` | Single run detail |
| GET | `/evaluations/runs/:id/results` | Paginated scored results |
| GET | `/evaluations/summary` | Latest stats per evaluator (for KPI cards) |
| GET | `/evaluations/config` | Available evaluators + API key status |
| DELETE | `/evaluations/runs/:id` | Delete run + cascade results |
| GET | `/projects` | List distinct projects (derived from event cwds) |

### Database tables

Three tables added to the existing SQLite database:

- **`evaluation_runs`** — run metadata: evaluator type, scope, status, progress, summary, model/prompt version for reproducibility
- **`evaluation_results`** — individual scored items with `numeric_score` (denormalized for fast aggregation), dimension scores in `scores_json`, and optional LLM rationale
- **`evaluation_baselines`** — snapshots of metric statistics saved when regression detection runs, used for future comparisons

## Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Hooks** | Python 3.10+ / uv | Event emission from Claude Code + Gemini CLI |
| **Server** | Bun + SQLite (WAL) | HTTP + WebSocket server, event storage |
| **Client** | React 19 + TypeScript + Vite (Bun) | Dashboard UI |
| **Styling** | Tailwind CSS v3 | Dark industrial theme |
| **Charts** | SVG (zero deps) | Data visualization |
| **Transport** | WebSocket | Real-time event streaming |
| **Evaluations** | Anthropic / Gemini (pluggable) | LLM-as-judge for quality scoring |
| **Server Tests** | Bun test | DB + API + WebSocket integration tests |
| **E2E Tests** | Playwright (Chromium) | Browser tests for dashboard, events, transcripts |

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
ANTHROPIC_API_KEY=sk-ant-...                  # Enables Anthropic provider (Claude Sonnet)
GOOGLE_API_KEY=AI...                          # Enables Gemini provider
EVAL_PROVIDER=                                # Force provider: anthropic | gemini (default: auto-detect)
EVAL_MODEL=                                   # Override model (default: per-provider)
```

## Learn More

See [docs/architecture.md](docs/architecture.md) for the full system architecture, data flow, and database schema. See [docs/hook-setup.md](docs/hook-setup.md) for configuring hooks in your projects.
