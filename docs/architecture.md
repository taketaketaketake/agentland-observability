# Architecture

## Current State

### Implemented

- Hook system with 16 event types wired via `.claude/settings.json`
- Bun HTTP + WebSocket server with SQLite persistence (WAL mode)
- React dashboard with four tabs: Live, Insights, Transcripts, Evals
- Real-time event streaming via WebSocket
- Agent status tracking (active/idle/stopped)
- Session transcript ingestion and viewing
- Human-in-the-loop question/response flow
- Insights dashboard with KPIs, donut charts, area charts, bar charts (zero chart deps)
- LLM evaluation system with 4 evaluators (tool success, transcript quality with user input scoring, reasoning quality, regression detection)
- Evaluation scope filters (time range, project, session) for targeted evaluation runs
- Multi-provider LLM support (Anthropic, Gemini) for evaluation judge calls
- Safety gate in `pre_tool_use.py` blocking dangerous commands

### Not Yet Implemented

- Authentication / multi-user access
- Persistent sessions across server restarts (events persist, WS clients reconnect)
- Event export / replay
- Alerting / notification rules

### Testing

- **Server tests** (`apps/server/tests/`): 31 Bun tests covering DB operations (in-memory SQLite) and API/WebSocket endpoints (real server on random port with temp DB)
- **E2E tests** (`apps/client/e2e/`): 5 Playwright tests covering dashboard loading, tab switching, real-time event delivery via WebSocket, multi-agent display, and transcript viewing
- Server is testable via `createServer({ port, dbPath })` export and `import.meta.main` guard
- E2E uses dedicated ports (server 4444, client 5174) with a fresh temp DB per run

## Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Claude Code Agent(s)                        │
│                     (source_app + session_id)                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │  Hook lifecycle events (stdin → Python)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Hook Scripts                                │
│                     .claude/hooks/*.py                              │
│                                                                     │
│  pre_tool_use ─── safety gate (block rm -rf, .env)                 │
│  post_tool_use, post_tool_use_failure ─── tool lifecycle           │
│  session_start, session_end ─── session lifecycle + transcript     │
│  stop, subagent_start, subagent_stop ─── agent lifecycle           │
│  user_prompt_submit, permission_request ─── user interaction       │
│  notification, config_change, pre_compact ─── system events        │
│  teammate_idle, task_completed ─── coordination events             │
└────────────────────────────┬────────────────────────────────────────┘
                             │  HTTP POST /events  (+ POST /transcripts)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Bun Server (port 4000)                        │
│                     apps/server/src/index.ts                       │
│                                                                     │
│  REST API ──────────── SQLite (WAL) ──────────── WebSocket         │
│  POST /events          events table              ws://…/stream     │
│  GET  /events/recent   messages table            broadcast on      │
│  GET  /transcripts     evaluation_runs           every insert      │
│  GET  /transcripts/:id evaluation_results                          │
│  POST /transcripts     evaluation_baselines                        │
│  POST /events/:id/respond ─── HITL response → agent WS            │
│  POST /evaluations/run ── Evaluators ── LLM Provider (Anthropic/  │
│  GET  /evaluations/*      (async)       Gemini) → judge calls     │
└────────────────────────────┬────────────────────────────────────────┘
                             │  WebSocket { type: 'event', data }
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   React Dashboard (port 5173)                      │
│                     apps/client/src/App.tsx                         │
│                                                                     │
│  ┌──────────┐  ┌────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │  Live    │  │  Insights  │  │ Transcripts │  │   Evals    │  │
│  │  Tab     │  │  Tab       │  │ Tab         │  │   Tab      │  │
│  │          │  │            │  │             │  │            │  │
│  │ Timeline │  │ KPIs       │  │ Session     │  │ KPIs       │  │
│  │ Agents   │  │ Charts     │  │ list        │  │ Evaluator  │  │
│  │ Chart    │  │ Rankings   │  │ Click→view  │  │ cards      │  │
│  │ Filters  │  │            │  │             │  │ Run history│  │
│  └──────────┘  └────────────┘  └─────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Boundaries

### Sacred Rule

**Use `source_app` + `session_id` to uniquely identify an agent.** Every hook event includes both fields. For display, the agent ID is `source_app:session_id` with session_id truncated to the first 8 characters. When `payload.cwd` is available, `project_name` replaces `source_app` in the display ID.

### Current Boundary Integrity

- Hooks are fire-and-forget: a 2-second timeout ensures hooks never block the agent
- Server accepts events from any source (no auth) — designed for local/trusted networks
- Client connects to a single server instance via WebSocket
- `pre_tool_use.py` enforces safety: blocks `rm -rf /`, `rm -rf ~`, and `.env` file access

## Infrastructure

### Services

| Service | Runtime | Port | Purpose |
|---------|---------|------|---------|
| Server | Bun | 4000 | HTTP REST + WebSocket + SQLite |
| Client | Vite (dev) / static (prod) | 5173 | React dashboard |
| Hooks | Python via `uv run --script` | — | Event emission scripts |
| Server Tests | Bun test | — | DB + API + WebSocket integration tests |
| E2E Tests | Playwright (Chromium) | 4444/5174 | Browser tests against test server |

### Databases

**SQLite** (`apps/server/events.db`) with WAL mode and `synchronous = NORMAL`.

#### Table: `events`

Stores all hook events received from agents.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER | Primary key, autoincrement |
| `source_app` | TEXT NOT NULL | e.g. `claude-code` |
| `session_id` | TEXT NOT NULL | UUID identifying the session |
| `hook_event_type` | TEXT NOT NULL | e.g. `PreToolUse`, `SessionEnd` |
| `payload` | TEXT NOT NULL | JSON blob with event-specific data |
| `chat` | TEXT | JSON array of chat messages (optional) |
| `summary` | TEXT | Human-readable summary (optional) |
| `timestamp` | INTEGER NOT NULL | Unix epoch milliseconds |
| `humanInTheLoop` | TEXT | JSON HITL question data (optional) |
| `humanInTheLoopStatus` | TEXT | JSON HITL response status (optional) |
| `model_name` | TEXT | Model used for this event (optional) |

**Indexes:** `source_app`, `session_id`, `hook_event_type`, `timestamp`

#### Table: `messages`

Stores transcript messages ingested at session end.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER | Primary key, autoincrement |
| `session_id` | TEXT NOT NULL | Links to the agent session |
| `source_app` | TEXT NOT NULL | e.g. `claude-code` |
| `role` | TEXT NOT NULL | `user` or `assistant` |
| `content` | TEXT NOT NULL | Message text |
| `thinking` | TEXT | Assistant thinking block (optional) |
| `model` | TEXT | Model name (optional) |
| `input_tokens` | INTEGER | Token count (optional) |
| `output_tokens` | INTEGER | Token count (optional) |
| `timestamp` | TEXT NOT NULL | ISO 8601 string |
| `uuid` | TEXT NOT NULL | Unique message identifier |

**Indexes:** `session_id`, `timestamp`, `uuid` (UNIQUE — deduplicates on re-ingestion)

#### Table: `evaluation_runs`

Stores metadata for each evaluation execution.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER | Primary key, autoincrement |
| `evaluator_type` | TEXT NOT NULL | `tool_success`, `transcript_quality`, `reasoning_quality`, `regression` |
| `scope_type` | TEXT NOT NULL | `session`, `agent`, `global` |
| `scope_session_id` | TEXT | Nullable — filter to specific session |
| `scope_source_app` | TEXT | Nullable — filter to specific agent |
| `status` | TEXT NOT NULL | `pending`, `running`, `completed`, `failed` |
| `progress_current` | INTEGER | Items processed so far |
| `progress_total` | INTEGER | Total items to process |
| `summary_json` | TEXT | Aggregated results (JSON) |
| `error_message` | TEXT | Error details if failed |
| `model_name` | TEXT | LLM model used (for reproducibility) |
| `prompt_version` | TEXT | Judge prompt version (for drift detection) |
| `options_json` | TEXT | Run options snapshot (JSON) |
| `created_at` | INTEGER NOT NULL | Epoch ms |
| `started_at` | INTEGER | Epoch ms |
| `completed_at` | INTEGER | Epoch ms |

**Indexes:** `evaluator_type`, `status`, `created_at`

#### Table: `evaluation_results`

Stores individual scored items from evaluation runs.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER | Primary key, autoincrement |
| `run_id` | INTEGER NOT NULL | FK → evaluation_runs |
| `session_id` | TEXT NOT NULL | Agent session |
| `source_app` | TEXT NOT NULL | Agent source app |
| `item_type` | TEXT NOT NULL | `tool_invocation`, `assistant_message`, `thinking_block` |
| `item_id` | TEXT NOT NULL | Event id or message uuid |
| `numeric_score` | REAL NOT NULL | Denormalized for fast SQL aggregation |
| `scores_json` | TEXT NOT NULL | Dimension scores (JSON) |
| `rationale` | TEXT | LLM explanation (null for logic evals) |
| `metadata_json` | TEXT | Tool name, message snippet, etc. (JSON) |
| `created_at` | INTEGER NOT NULL | Epoch ms |

**Indexes:** `run_id`, `session_id`

#### Table: `evaluation_baselines`

Snapshots of metric statistics saved by the regression evaluator for future comparisons.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER | Primary key, autoincrement |
| `evaluator_type` | TEXT NOT NULL | Source evaluator |
| `metric_name` | TEXT NOT NULL | e.g. `tool_success_rate`, `avg_helpfulness` |
| `model_name` | TEXT | Judge model (for drift filtering) |
| `prompt_version` | TEXT | Prompt version (for drift filtering) |
| `window_start` | INTEGER NOT NULL | Epoch ms |
| `window_end` | INTEGER NOT NULL | Epoch ms |
| `sample_count` | INTEGER NOT NULL | Number of data points |
| `mean_score` | REAL NOT NULL | Window mean |
| `stddev_score` | REAL NOT NULL | Window standard deviation |
| `percentile_json` | TEXT | `{"p25":…,"p50":…,"p75":…}` (JSON) |
| `created_at` | INTEGER NOT NULL | Epoch ms |

**Indexes:** `evaluator_type`

## Data Flow

### Event Pipeline

```
1. Agent executes action (e.g. tool call)
2. Claude Code fires hook (e.g. PreToolUse)
3. Hook script reads JSON from stdin
4. Script extracts session_id, source_app, constructs event payload
5. HTTP POST → http://localhost:4000/events (2s timeout, fail silently)
6. Server validates, inserts to SQLite, assigns id + timestamp
7. Server broadcasts { type: 'event', data } to all WebSocket clients
8. Client appends event to state, React re-renders affected components
```

### Transcript Ingestion

```
1. Agent session ends → SessionEnd hook fires
2. session_end.py sends SessionEnd event to /events
3. session_end.py reads ~/.claude/projects/{cwd-dashed}/{session_id}.jsonl
4. Parses JSONL → extracts user/assistant messages
5. Merges thinking-only records (separate JSONL entries with only thinking content blocks) into the next assistant text response
6. HTTP POST → /transcripts with messages array (including merged thinking blocks)
7. Server inserts into messages table (INSERT OR IGNORE by uuid)
```

### Human-in-the-Loop

```
1. Agent sends event with humanInTheLoop field (question + WS URL)
2. Server stores event, broadcasts to dashboard
3. Dashboard renders HITL prompt with input field
4. User types response, POST → /events/:id/respond
5. Server stores response, sends to agent's WS URL, broadcasts update
```

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/events` | Receive hook event from agent |
| GET | `/events/recent?limit=300` | Fetch recent events |
| GET | `/events/filter-options` | List distinct source_apps, session_ids, event types |
| POST | `/events/:id/respond` | Submit HITL response |
| POST | `/transcripts` | Ingest transcript messages |
| GET | `/transcripts?project_dir=` | List transcript sessions (optionally filtered by project) |
| GET | `/transcripts/:session_id` | Get messages for a specific session |
| GET | `/projects` | List distinct projects derived from event cwds |
| POST | `/evaluations/run` | Start an evaluation run (returns 202) |
| GET | `/evaluations/runs` | List runs (filterable by type/status) |
| GET | `/evaluations/runs/:id` | Single run detail |
| GET | `/evaluations/runs/:id/results` | Paginated scored results |
| GET | `/evaluations/summary` | Latest stats per evaluator type |
| GET | `/evaluations/config` | Available evaluators + configured providers |
| DELETE | `/evaluations/runs/:id` | Delete run + cascade results |
| WS | `/stream` | Real-time event stream (includes `evaluation_progress` messages) |

### WebSocket Protocol

**On connect:** Server sends `{ type: 'initial', data: HookEvent[] }` with the last 300 events.

**On new event:** Server broadcasts `{ type: 'event', data: HookEvent }` to all clients.

**On evaluation progress:** Server broadcasts `{ type: 'evaluation_progress', data: { run_id, status, progress_current, progress_total } }` during eval runs.

**Reconnection:** Client auto-reconnects after 3 seconds on disconnect.

## Client Components

### Tabs

| Tab | Component | Purpose |
|-----|-----------|---------|
| Live | `EventTimeline` + `AgentStatusPanel` + `LivePulseChart` | Real-time event feed with agent sidebar |
| Insights | `InsightsPanel` | KPIs, event breakdowns, tool rankings |
| Transcripts | `TranscriptsListPanel` | Browse and search all session transcripts |
| Evals | `EvaluationsPanel` | Scope filters, run evaluations, view scores, drill into results |

### Key Components

| Component | Purpose |
|-----------|---------|
| `EventRow` | Single event with agent tag, type badge, tool name, summary, chat/transcript buttons |
| `AgentStatusPanel` | Sidebar listing agents with status indicators and event counts |
| `AgentSwimLaneContainer` | Horizontal timeline lanes for selected agents |
| `LivePulseChart` | Area chart of events/minute with event type breakdown |
| `SessionTranscriptPanel` | Slide-out panel showing conversation messages |
| `FilterPanel` | Dropdown filters for source app, session, event type |
| `ToastNotification` | Floating alert when a new agent connects |
| `EvaluationsPanel` | Evals tab: scope filter bar, KPI cards, evaluator cards with charts, run history |
| `EvalRunDetailPanel` | Drill-down into individual scored results with rationale |
| `SuccessRateChart` | Stacked bars showing tool success/failure ratios |
| `ScoreDistributionChart` | Horizontal bars showing 1-5 score dimensions |

### Custom Hooks

| Hook | Purpose |
|------|---------|
| `useWebSocket` | WS connection, reconnection, event buffering (max 300) |
| `useAgentStatus` | Groups events by agent, determines active/idle/stopped status |
| `useEventColors` | Deterministic color assignment per source_app |
| `useEventEmojis` | Maps tool names to emoji icons |
| `useInsightsData` | Aggregates KPIs, builds chart datasets |
| `useChartData` | Buckets events into time ranges for the pulse chart |
| `useEvaluations` | Eval state management, run triggers, WebSocket progress, project/session fetching |

### Agent Status Logic

| Status | Condition |
|--------|-----------|
| **Active** | Last event within 2 minutes |
| **Idle** | No event in 2+ minutes |
| **Stopped** | Last event type is `SessionEnd`, `Stop`, or `SubagentStop` |

Agents are hidden from the sidebar after 10 minutes of inactivity.

## Hook System

All hooks are Python scripts executed via `uv run --script` with PEP 723 inline metadata for dependency declaration.

### Hook Categories

**Self-contained** (no local imports): `pre_tool_use.py`, `post_tool_use.py`

**Use shared helper** (`send_event.py`): All other hooks import `send_event()` after inserting the hooks directory into `sys.path`.

**Complex**: `session_end.py` handles both the SessionEnd event and transcript JSONL ingestion. It buffers thinking-only JSONL records (entries with only a `thinking` content block) and merges them into the next assistant text response, ensuring thinking blocks are preserved in the messages table.

### Wired Hook Events

All events configured in `.claude/settings.json`:

`PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`, `Notification`, `Stop`, `SubagentStart`, `SubagentStop`, `PreCompact`, `UserPromptSubmit`, `SessionStart`, `SessionEnd`, `TeammateIdle`, `TaskCompleted`

**Not wired** (scripts exist but not in settings): `worktree_create.py`, `worktree_remove.py`
