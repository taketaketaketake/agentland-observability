# What Is AgentLand Observability?

A real-time dashboard that lets you watch what your AI coding agents are doing as they work.

When you use AI coding tools like Claude Code or Gemini CLI, they operate somewhat like black boxes — they read files, run commands, write code, and make decisions, but you only see the final output. This project gives you a live, visual window into everything that's happening across all your agent sessions, all in one place.

Think of it like air traffic control, but for AI agents working on your code.

## The Problem It Solves

If you're running multiple AI coding agents — maybe Claude Code in one terminal working on the backend and Gemini CLI in another working on the frontend — you have no unified way to see what's happening. You're tab-switching between terminals, scrolling through output, and hoping nothing goes wrong while you're not looking.

AgentLand Observability fixes this by capturing every meaningful event from every agent and streaming it to a single dashboard in your browser. You can see which agents are active, what tools they're using, whether those tools succeeded or failed, and even read the full conversation transcripts after sessions end. On top of that, it includes an evaluation system that uses LLMs to score the quality of your agents' work.

## How It Works

The system has four parts:

### 1. Hook Scripts (the ears)

Both Claude Code and Gemini CLI have a "hooks" system — they can run small scripts whenever certain things happen, like before a tool runs, after a tool finishes, when a session starts or ends, etc. This project includes Python scripts that plug into those hooks. Every time something happens in an agent session, the hook script fires off a tiny HTTP request to the server with the event details. The scripts are lightweight and fail silently — if the dashboard server isn't running, the agents keep working normally without any interruption.

There are hooks for 14 different Claude Code events and 8 Gemini CLI events. They capture things like tool usage (file reads, writes, shell commands), session lifecycle (start, end, stop), permission requests, notifications, and more.

One of the Claude Code hooks also acts as a safety gate: before any tool runs, `pre_tool_use.py` checks whether the command is dangerous (like `rm -rf /` or accessing `.env` files) and blocks it if so.

### 2. The Server (the brain)

A lightweight Bun server with a SQLite database. It does three things:

- Accepts incoming events via a REST API and stores them in the database
- Immediately broadcasts each new event to all connected dashboard clients via WebSocket
- Serves REST endpoints for retrieving historical data, transcripts, and evaluation results

When a session ends, the hook script also reads the full conversation transcript (the JSONL file that Claude Code writes to disk) and sends it to the server. The server stores each message — including the AI's internal "thinking" blocks — so you can review the full conversation later.

### 3. The Dashboard (the eyes)

A React app with four tabs:

- **Live** — A real-time event feed. Events appear instantly as they happen. Each agent gets its own color. You can see a timeline of events per agent in horizontal "swim lanes," and a pulse chart showing events-per-minute over time. If an agent asks a human-in-the-loop question, it appears here and you can type your response directly in the dashboard.

- **Insights** — Analytics view. Shows KPIs (total events, active agents, sessions), event type breakdowns, tool success/failure rates as bar charts, and agent activity rankings. Useful for understanding patterns across sessions.

- **Transcripts** — Browse and read the full conversation history of any completed session. You can see every user prompt and assistant response, including the AI's thinking process. Transcripts are searchable and accessible from multiple entry points in the UI.

- **Evals** — An evaluation system that scores agent quality. You can run evaluations scoped by time range, project, or specific session.

### 4. The Evaluation System (the judge)

There are four evaluators you can run on-demand from the dashboard:

- **Tool Success** — Pure logic, no LLM needed. Counts how often each tool succeeded vs. failed across agents and sessions. Zero cost.

- **Transcript Quality** — Uses an LLM (Claude or Gemini) as a judge to score each conversation exchange. It evaluates user input quality (was the prompt clear? did it have enough context?) and assistant response quality (was it helpful? accurate? concise?) on a 1-5 scale across five dimensions. Uses stratified sampling so it evaluates exchanges evenly across sessions.

- **Reasoning Quality** — Also uses an LLM judge. Evaluates the AI's internal thinking blocks for depth, coherence, and self-correction ability. This tells you whether the agent is actually reasoning well or just producing surface-level responses.

- **Regression Detection** — Pure statistics, no LLM needed. Compares the last 24 hours of metrics against a 7-day baseline using z-score tests. Automatically flags if quality has gotten significantly worse (or better). Zero cost.

Evaluations run asynchronously on the server and stream their progress back to the dashboard in real time via WebSocket, so you see a live progress bar as items are scored.

## How Events Flow Through the System

1. You're running Claude Code (or Gemini CLI) and it decides to read a file
2. Before the tool runs, Claude Code fires its `PreToolUse` hook
3. The Python hook script reads the event data from stdin, wraps it with the session ID and source app name, and sends an HTTP POST to `localhost:4000/events`
4. The server saves the event to SQLite and immediately broadcasts it over WebSocket to all connected dashboards
5. The React dashboard receives the WebSocket message and re-renders — the event appears in the live feed, the agent's status badge updates, and the charts refresh
6. When the session ends, another hook reads the full transcript file from disk and uploads it to the server for permanent storage

The whole pipeline takes milliseconds. Events appear on the dashboard essentially in real time.

## Agent Identity

Every event carries two fields: `source_app` (like `claude-code` or `gemini-cli`) and `session_id` (a UUID). Together they uniquely identify an agent session. In the dashboard, agents are displayed as something like `claude-code:a3f8b2c1` (with the session ID truncated to 8 characters for readability). When the event includes a working directory, the project name replaces the source app in the display for more useful context.

Agents are shown as "active" if they've sent an event in the last 2 minutes, "idle" if it's been longer, and "stopped" once a session-end event arrives. After 10 minutes of inactivity, agents disappear from the sidebar to keep things clean.
