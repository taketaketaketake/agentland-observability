# Database Reference

The observability server uses a single SQLite database (`apps/server/events.db`) in WAL mode for concurrent reads during WebSocket streaming.

## Backup & Restore

### Quick commands

```bash
# Snapshot with a descriptive tag
just db-backup "before-schema-change"
# → backups/events-before-schema-change-2025-02-25_143000.db

# Snapshot without a tag (timestamp only)
just db-backup
# → backups/events-2025-02-25_143000.db

# List all backups with sizes
just db-list

# Restore a backup (auto-saves current DB first)
just db-restore "events-before-schema-change-2025-02-25_143000.db"

# Wipe the database entirely
just db-reset
```

### How it works

- Backups are plain SQLite file copies stored in `backups/` at the repo root (gitignored).
- Each backup filename includes an optional tag and a timestamp: `events-{tag}-{YYYY-MM-DD_HHMMSS}.db`
- `db-restore` automatically backs up the current database as `events-pre-restore-{timestamp}.db` before overwriting, so you can always undo a restore.
- `db-reset` deletes the database and WAL/SHM files. The server recreates tables on next startup.

### When to back up

- Before schema migrations or breaking changes
- Before running `db-reset`
- When you have a "golden" dataset useful for demos or eval testing
- Before restoring a different backup

## Schema

All tables are created in `apps/server/src/db.ts` via `CREATE TABLE IF NOT EXISTS`. The server auto-creates them on startup.

### `events`

Primary event store. Every hook event from Claude Code and Gemini CLI is inserted here.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `source_app` | TEXT NOT NULL | `"claude-code"`, `"gemini-cli"`, `"git"`, etc. |
| `session_id` | TEXT NOT NULL | Agent session identifier |
| `hook_event_type` | TEXT NOT NULL | `PreToolUse`, `PostToolUse`, `SessionStart`, etc. |
| `payload` | TEXT NOT NULL | JSON string — tool name, input, output, cwd, etc. |
| `chat` | TEXT | JSON string — human-in-the-loop chat messages |
| `summary` | TEXT | One-line event summary |
| `timestamp` | INTEGER NOT NULL | Unix epoch milliseconds |
| `humanInTheLoop` | TEXT | JSON — HITL prompt data |
| `humanInTheLoopStatus` | TEXT | JSON — `{ status, respondedAt, response }` |
| `model_name` | TEXT | LLM model used (when available) |

**Indexes:** `source_app`, `session_id`, `hook_event_type`, `timestamp`

### `messages`

Transcript messages ingested from Claude Code JSONL transcripts at session end.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `session_id` | TEXT NOT NULL | Links to `events.session_id` |
| `source_app` | TEXT NOT NULL | `"claude-code"` (Gemini transcripts not yet supported) |
| `role` | TEXT NOT NULL | `"user"` or `"assistant"` |
| `content` | TEXT NOT NULL | Message text |
| `thinking` | TEXT | Extended thinking blocks (merged from thinking-only records) |
| `model` | TEXT | Model name (e.g. `claude-sonnet-4-20250514`) |
| `input_tokens` | INTEGER | Token count for the request |
| `output_tokens` | INTEGER | Token count for the response |
| `timestamp` | TEXT NOT NULL | ISO 8601 timestamp |
| `uuid` | TEXT NOT NULL | Unique message identifier (dedup key) |

**Indexes:** `session_id`, `timestamp`, `uuid` (unique)

### `evaluation_runs`

Metadata for each evaluation execution (triggered from the Evals tab).

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `evaluator_type` | TEXT NOT NULL | `tool_success`, `transcript_quality`, `reasoning_quality`, `regression` |
| `scope_type` | TEXT NOT NULL | `all`, `session`, `time_window` |
| `scope_session_id` | TEXT | Session filter (when scoped to one session) |
| `scope_source_app` | TEXT | Source app filter |
| `status` | TEXT NOT NULL | `pending` → `running` → `completed` / `failed` |
| `progress_current` | INTEGER | Items processed so far |
| `progress_total` | INTEGER | Total items to process |
| `summary_json` | TEXT | JSON — aggregated results summary |
| `error_message` | TEXT | Error details if failed |
| `model_name` | TEXT | LLM model used for judge calls |
| `prompt_version` | TEXT | Prompt version for reproducibility |
| `options_json` | TEXT | JSON — scope filters, time window, etc. |
| `created_at` | INTEGER | Unix epoch ms |
| `started_at` | INTEGER | Unix epoch ms |
| `completed_at` | INTEGER | Unix epoch ms |

**Indexes:** `evaluator_type`, `status`, `created_at`

### `evaluation_results`

Individual scored items from evaluation runs.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `run_id` | INTEGER NOT NULL | FK to `evaluation_runs.id` |
| `session_id` | TEXT NOT NULL | Which session this result is for |
| `source_app` | TEXT NOT NULL | Agent source app |
| `item_type` | TEXT NOT NULL | `tool_use`, `transcript_pair`, `thinking_block`, etc. |
| `item_id` | TEXT NOT NULL | Identifier for the scored item |
| `numeric_score` | REAL NOT NULL | Denormalized overall score (for fast aggregation) |
| `scores_json` | TEXT NOT NULL | JSON — per-dimension scores (e.g. `{ clarity: 4, accuracy: 5 }`) |
| `rationale` | TEXT | LLM judge explanation |
| `metadata_json` | TEXT | JSON — additional context |
| `created_at` | INTEGER NOT NULL | Unix epoch ms |

**Indexes:** `run_id`, `session_id`

### `evaluation_baselines`

Statistical snapshots saved by regression detection for future comparisons.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `evaluator_type` | TEXT NOT NULL | Which evaluator this baseline is for |
| `metric_name` | TEXT NOT NULL | Metric being tracked |
| `model_name` | TEXT | Model used |
| `prompt_version` | TEXT | Prompt version (only compare matching versions) |
| `window_start` | INTEGER NOT NULL | Baseline window start (epoch ms) |
| `window_end` | INTEGER NOT NULL | Baseline window end (epoch ms) |
| `sample_count` | INTEGER NOT NULL | Number of data points |
| `mean_score` | REAL NOT NULL | Statistical mean |
| `stddev_score` | REAL NOT NULL | Standard deviation |
| `percentile_json` | TEXT | JSON — percentile distribution |
| `created_at` | INTEGER NOT NULL | Unix epoch ms |

**Indexes:** `evaluator_type`

### `session_analyses`

AI-generated session summaries and analyses (Insights tab).

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `session_id` | TEXT NOT NULL | One analysis per session (unique) |
| `source_app` | TEXT NOT NULL | Agent source app |
| `status` | TEXT NOT NULL | `pending` → `running` → `completed` / `failed` |
| `analysis_json` | TEXT | JSON — structured analysis output |
| `summary` | TEXT | Short text summary |
| `error_message` | TEXT | Error details if failed |
| `model_name` | TEXT | LLM model used |
| `prompt_version` | TEXT | Prompt version |
| `message_count` | INTEGER | Messages analyzed |
| `tokens_analyzed` | INTEGER | Tokens processed |
| `created_at` | INTEGER NOT NULL | Unix epoch ms |
| `completed_at` | INTEGER | Unix epoch ms |

**Indexes:** `session_id` (unique), `status`

### `cross_session_insights`

Aggregated insights computed across multiple sessions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `insight_key` | TEXT NOT NULL | Unique key (e.g. `"cross-session-summary"`) |
| `analysis_json` | TEXT NOT NULL | JSON — aggregated analysis |
| `model_name` | TEXT | LLM model used |
| `session_count` | INTEGER | Number of sessions analyzed |
| `created_at` | INTEGER NOT NULL | Unix epoch ms |

## Configuration

| Setting | Value | Purpose |
|---------|-------|---------|
| `journal_mode` | WAL | Concurrent reads during writes |
| `synchronous` | NORMAL | Balanced durability/performance |

The database file lives at `apps/server/events.db` with WAL files (`events.db-wal`, `events.db-shm`) alongside it. All three are gitignored.
