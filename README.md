# Claude Code Observability

Real-time observability dashboard for multi-agent Claude Code sessions. Captures hook events, streams them over WebSocket, and displays them in a live mission-control UI with agent tracking, transcript viewing, analytics, and LLM-powered evaluation.

## What This Is

When you run Claude Code, it fires lifecycle hooks (tool use, session start/end, permissions, etc.). This system captures those hooks, stores them in SQLite, and streams them to a React dashboard in real time. You get:

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
│   │   ├── tests/                    # Bun test suite (DB + API + WebSocket)
│   │   └── src/
│   │       ├── index.ts              # HTTP routes + WebSocket server
│   │       ├── db.ts                 # SQLite schema, queries, WAL mode
│   │       ├── types.ts              # Shared TypeScript interfaces
│   │       ├── evaluations.ts        # Evaluation CRUD (runs, results, baselines)
│   │       ├── evaluationRunner.ts   # Evaluator orchestration + progress broadcast
│   │       └── evaluators/           # Pluggable evaluator modules
│   │           ├── types.ts          # Evaluator interface
│   │           ├── anthropicClient.ts # Claude API wrapper for LLM-as-judge
│   │           ├── toolSuccess.ts    # Tool success/failure rate (no API key)
│   │           ├── transcriptQuality.ts  # LLM judge: helpfulness/accuracy/conciseness
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

The Evals tab lets you assess agent quality on-demand. Click "Run" on any evaluator card to score recent activity.

### Evaluators

| Evaluator | What it measures | API key needed | Cost |
|-----------|-----------------|----------------|------|
| **Tool Success** | Success/failure rate per tool and agent | No | Zero (pure logic) |
| **Transcript Quality** | Helpfulness, accuracy, conciseness (1-5 each) | Yes | LLM calls |
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
- **Transcript quality** uses stratified sampling across sessions, then sends each (user message, assistant response) pair to Claude as a judge
- **Reasoning quality** evaluates thinking blocks with the same stratified sampling approach
- **Regression** compares a baseline window (7 days ago → 24h ago) against the current window (last 24h) using z-score tests. Flags metrics with z < -2.0 (degraded) or z > 2.0 (improved)

LLM evaluators use `temperature: 0` for deterministic scoring. Prompt versions are tracked so regression detection only compares results from matching prompt versions.

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

### Database tables

Three tables added to the existing SQLite database:

- **`evaluation_runs`** — run metadata: evaluator type, scope, status, progress, summary, model/prompt version for reproducibility
- **`evaluation_results`** — individual scored items with `numeric_score` (denormalized for fast aggregation), dimension scores in `scores_json`, and optional LLM rationale
- **`evaluation_baselines`** — snapshots of metric statistics saved when regression detection runs, used for future comparisons

## Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Hooks** | Python 3.10+ / uv | Event emission from Claude Code |
| **Server** | Bun + SQLite (WAL) | HTTP + WebSocket server, event storage |
| **Client** | React 19 + TypeScript + Vite | Dashboard UI |
| **Styling** | Tailwind CSS v3 | Dark industrial theme |
| **Charts** | SVG (zero deps) | Data visualization |
| **Transport** | WebSocket | Real-time event streaming |
| **Evaluations** | Claude API (Sonnet) | LLM-as-judge for quality scoring |
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

# Evaluations (optional)
ANTHROPIC_API_KEY=sk-...                      # Required for LLM-as-judge evaluators
EVAL_MODEL=claude-sonnet-4-20250514           # Judge model (default: claude-sonnet-4-20250514)
```

## Learn More

See [docs/architecture.md](docs/architecture.md) for the full system architecture, data flow, and database schema.
