import { initDatabase, insertEvent, getFilterOptions, getRecentEvents, updateEventHITLResponse, insertMessages, getSessionMessages, listTranscriptSessions, getDistinctProjects, getHistoricalInsights, getSessionAnalysis, listSessionAnalyses, upsertSessionAnalysis } from './db';
import { createEvalRun, getEvalRun, listEvalRuns, updateEvalRunStatus, deleteEvalRun, insertEvalResults, getEvalResults, getEvalSummary } from './evaluations';
import { runEvaluation } from './evaluationRunner';
import { isAnyProviderConfigured, getConfiguredProviders, getProviderList } from './evaluators/llmProvider';
import { analyzeSession, synthesizeCrossSessions } from './sessionAnalyzer';
import type { HookEvent, HumanInTheLoopResponse, TranscriptMessage, EvalRunRequest, EvalConfig } from './types';

const MAX_EVENT_SIZE = 2 * 1024 * 1024;       // 2 MB
const MAX_TRANSCRIPT_SIZE = 10 * 1024 * 1024;  // 10 MB

function checkBodySize(req: Request, maxSize: number, headers: Record<string, string>): Response | null {
  const contentLength = req.headers.get('Content-Length');
  if (contentLength && parseInt(contentLength) > maxSize) {
    return new Response(JSON.stringify({ error: `Payload too large (max ${maxSize} bytes)` }), {
      status: 413,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
  return null;
}

async function sendResponseToAgent(
  wsUrl: string,
  response: HumanInTheLoopResponse
): Promise<void> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket | null = null;
    let isResolved = false;

    const cleanup = () => {
      if (ws) {
        try { ws.close(); } catch (_) { /* ignore */ }
      }
    };

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (isResolved) return;
        try {
          ws!.send(JSON.stringify(response));
          setTimeout(() => {
            cleanup();
            if (!isResolved) { isResolved = true; resolve(); }
          }, 500);
        } catch (error) {
          cleanup();
          if (!isResolved) { isResolved = true; reject(error); }
        }
      };

      ws.onerror = (error) => {
        cleanup();
        if (!isResolved) { isResolved = true; reject(error); }
      };

      ws.onclose = () => {};

      setTimeout(() => {
        if (!isResolved) {
          cleanup();
          isResolved = true;
          reject(new Error('Timeout sending response to agent'));
        }
      }, 5000);
    } catch (error) {
      cleanup();
      if (!isResolved) { isResolved = true; reject(error); }
    }
  });
}

export function createServer(options?: { port?: number; dbPath?: string }) {
  const port = options?.port ?? parseInt(process.env.SERVER_PORT || '4000');
  const dbPath = options?.dbPath ?? process.env.TEST_DB ?? 'events.db';

  initDatabase(dbPath);

  const corsOrigin = process.env.CORS_ORIGIN || `http://localhost:${process.env.VITE_PORT || '5173'}`;

  const wsClients = new Set<any>();

  const server = Bun.serve({
    port,

    async fetch(req: Request) {
      const url = new URL(req.url);

      const headers = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };

      if (req.method === 'OPTIONS') {
        return new Response(null, { headers });
      }

      // POST /events
      if (url.pathname === '/events' && req.method === 'POST') {
        const sizeError = checkBodySize(req, MAX_EVENT_SIZE, headers);
        if (sizeError) return sizeError;
        try {
          const event: HookEvent = await req.json();
          if (!event.source_app || !event.session_id || !event.hook_event_type || !event.payload) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
              status: 400,
              headers: { ...headers, 'Content-Type': 'application/json' },
            });
          }

          const savedEvent = insertEvent(event);

          const message = JSON.stringify({ type: 'event', data: savedEvent });
          wsClients.forEach(client => {
            try { client.send(message); } catch (_) { wsClients.delete(client); }
          });

          return new Response(JSON.stringify(savedEvent), {
            headers: { ...headers, 'Content-Type': 'application/json' },
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Invalid request' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' },
          });
        }
      }

      // GET /events/filter-options
      if (url.pathname === '/events/filter-options' && req.method === 'GET') {
        const options = getFilterOptions();
        return new Response(JSON.stringify(options), {
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }

      // GET /events/recent
      if (url.pathname === '/events/recent' && req.method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '300');
        const events = getRecentEvents(limit);
        return new Response(JSON.stringify(events), {
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }

      // POST /events/:id/respond
      if (url.pathname.match(/^\/events\/\d+\/respond$/) && req.method === 'POST') {
        const sizeError = checkBodySize(req, MAX_EVENT_SIZE, headers);
        if (sizeError) return sizeError;
        const id = parseInt(url.pathname.split('/')[2]);
        try {
          const response: HumanInTheLoopResponse = await req.json();
          response.respondedAt = Date.now();

          const updatedEvent = updateEventHITLResponse(id, response);
          if (!updatedEvent) {
            return new Response(JSON.stringify({ error: 'Event not found' }), {
              status: 404,
              headers: { ...headers, 'Content-Type': 'application/json' },
            });
          }

          if (updatedEvent.humanInTheLoop?.responseWebSocketUrl) {
            try {
              await sendResponseToAgent(updatedEvent.humanInTheLoop.responseWebSocketUrl, response);
            } catch (_) { /* don't fail the request */ }
          }

          const message = JSON.stringify({ type: 'event', data: updatedEvent });
          wsClients.forEach(client => {
            try { client.send(message); } catch (_) { wsClients.delete(client); }
          });

          return new Response(JSON.stringify(updatedEvent), {
            headers: { ...headers, 'Content-Type': 'application/json' },
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Invalid request' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' },
          });
        }
      }

      // POST /transcripts
      if (url.pathname === '/transcripts' && req.method === 'POST') {
        const sizeError = checkBodySize(req, MAX_TRANSCRIPT_SIZE, headers);
        if (sizeError) return sizeError;
        try {
          const body = await req.json();
          const messages: TranscriptMessage[] = body.messages;
          if (!Array.isArray(messages) || messages.length === 0) {
            console.log(`[transcripts] POST /transcripts — empty or missing messages array`);
            return new Response(JSON.stringify({ error: 'messages array required' }), {
              status: 400,
              headers: { ...headers, 'Content-Type': 'application/json' },
            });
          }
          console.log(`[transcripts] POST /transcripts — ${messages.length} messages, session=${messages[0]?.session_id?.substring(0, 8)}`);
          const inserted = insertMessages(messages);
          console.log(`[transcripts] Inserted ${inserted}/${messages.length} messages`);

          // Fire-and-forget: auto-analyze session
          const sessionId = messages[0]?.session_id;
          const sourceApp = messages[0]?.source_app;
          if (sessionId && sourceApp && inserted > 0) {
            analyzeSession(sessionId, sourceApp).catch(err => {
              console.error(`[session-analyzer] Auto-analyze failed for ${sessionId.substring(0, 8)}:`, err.message);
            });
          }

          return new Response(JSON.stringify({ inserted, total: messages.length }), {
            headers: { ...headers, 'Content-Type': 'application/json' },
          });
        } catch (error) {
          console.error(`[transcripts] POST /transcripts error:`, error);
          return new Response(JSON.stringify({ error: 'Invalid request' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' },
          });
        }
      }

      // GET /insights/historical
      if (url.pathname === '/insights/historical' && req.method === 'GET') {
        const data = getHistoricalInsights();
        return new Response(JSON.stringify(data), {
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }

      // GET /projects
      if (url.pathname === '/projects' && req.method === 'GET') {
        const projects = getDistinctProjects();
        return new Response(JSON.stringify(projects), {
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }

      // GET /transcripts (listing)
      if (url.pathname === '/transcripts' && req.method === 'GET') {
        const projectDir = url.searchParams.get('project_dir') || undefined;
        const sessions = listTranscriptSessions(projectDir);
        console.log(`[transcripts] GET /transcripts — ${sessions.length} sessions${projectDir ? ` (project: ${projectDir})` : ''}`);
        return new Response(JSON.stringify(sessions), {
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }

      // GET /transcripts/:session_id
      if (url.pathname.startsWith('/transcripts/') && req.method === 'GET') {
        const sessionId = url.pathname.slice('/transcripts/'.length);
        if (!sessionId) {
          return new Response(JSON.stringify({ error: 'session_id required' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' },
          });
        }
        const messages = getSessionMessages(sessionId);
        console.log(`[transcripts] GET /transcripts/${sessionId.substring(0, 8)}… — ${messages.length} messages`);
        return new Response(JSON.stringify(messages), {
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }

      // ─── Session Analysis Endpoints ───

      // GET /session-analysis (list)
      if (url.pathname === '/session-analysis' && req.method === 'GET') {
        const status = url.searchParams.get('status') || undefined;
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const analyses = listSessionAnalyses({ status, limit });
        return new Response(JSON.stringify(analyses), {
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }

      // GET /session-analysis/:session_id
      if (url.pathname.match(/^\/session-analysis\/[^/]+$/) && req.method === 'GET' && !url.pathname.endsWith('/reanalyze')) {
        const sid = decodeURIComponent(url.pathname.slice('/session-analysis/'.length));
        const analysis = getSessionAnalysis(sid);
        if (!analysis) {
          return new Response(JSON.stringify({ status: 'not_found' }), {
            headers: { ...headers, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({
          ...analysis,
          analysis_json: analysis.analysis_json ? JSON.parse(analysis.analysis_json) : null,
        }), {
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }

      // POST /session-analysis/:session_id/reanalyze
      if (url.pathname.match(/^\/session-analysis\/[^/]+\/reanalyze$/) && req.method === 'POST') {
        const parts = url.pathname.split('/');
        const sid = decodeURIComponent(parts[2]!);
        // Reset and re-run
        const existing = getSessionAnalysis(sid);
        const srcApp = existing?.source_app || 'unknown';
        upsertSessionAnalysis({
          session_id: sid,
          source_app: srcApp,
          status: 'pending',
          created_at: Date.now(),
        });
        analyzeSession(sid, srcApp).catch(err => {
          console.error(`[session-analyzer] Re-analyze failed for ${sid.substring(0, 8)}:`, err.message);
        });
        return new Response(JSON.stringify({ status: 'reanalyzing' }), {
          status: 202,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }

      // GET /insights/ai
      if (url.pathname === '/insights/ai' && req.method === 'GET') {
        try {
          const rawIds = url.searchParams.get('session_ids');
          const filterSessionIds = rawIds ? rawIds.split(',').filter(Boolean) : undefined;
          const insights = await synthesizeCrossSessions(filterSessionIds);
          return new Response(JSON.stringify(insights), {
            headers: { ...headers, 'Content-Type': 'application/json' },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: 'synthesis_failed', message: err.message }), {
            status: 500,
            headers: { ...headers, 'Content-Type': 'application/json' },
          });
        }
      }

      // ─── Evaluation Endpoints ───

      // POST /evaluations/run — start an evaluation
      if (url.pathname === '/evaluations/run' && req.method === 'POST') {
        const sizeError = checkBodySize(req, MAX_EVENT_SIZE, headers);
        if (sizeError) return sizeError;
        try {
          const body: EvalRunRequest = await req.json();
          if (!body.evaluator_type || !body.scope?.type) {
            return new Response(JSON.stringify({ error: 'evaluator_type and scope.type required' }), {
              status: 400,
              headers: { ...headers, 'Content-Type': 'application/json' },
            });
          }

          const validTypes = ['tool_success', 'transcript_quality', 'reasoning_quality', 'regression'];
          if (!validTypes.includes(body.evaluator_type)) {
            return new Response(JSON.stringify({ error: `Invalid evaluator_type. Must be one of: ${validTypes.join(', ')}` }), {
              status: 400,
              headers: { ...headers, 'Content-Type': 'application/json' },
            });
          }

          // Resolve session_ids: prefer session_ids array, fallback to single session_id
          const sessionIds: string[] = body.scope.session_ids?.length
            ? body.scope.session_ids
            : body.scope.session_id
              ? [body.scope.session_id]
              : [];

          // Store in DB: JSON array if 2+, plain string if 1, null if none
          const scopeSessionId = sessionIds.length >= 2
            ? JSON.stringify(sessionIds)
            : sessionIds.length === 1
              ? sessionIds[0]
              : null;

          // Normalize scope for the evaluator with session_ids array
          const normalizedScope = {
            ...body.scope,
            session_ids: sessionIds.length > 0 ? sessionIds : undefined,
            session_id: sessionIds.length === 1 ? sessionIds[0] : undefined,
          };

          const run = createEvalRun({
            evaluator_type: body.evaluator_type,
            scope_type: body.scope.type,
            scope_session_id: scopeSessionId,
            scope_source_app: body.scope.source_app ?? null,
            status: 'pending',
            progress_current: 0,
            progress_total: 0,
            summary_json: null,
            error_message: null,
            model_name: null,
            prompt_version: null,
            options_json: body.options ?? null,
            created_at: Date.now(),
            started_at: null,
            completed_at: null,
          });

          // Run async — broadcast progress over WebSocket
          const broadcastProgress = (runId: number, status: string, current: number, total: number) => {
            const msg = JSON.stringify({
              type: 'evaluation_progress',
              data: { run_id: runId, status, progress_current: current, progress_total: total },
            });
            wsClients.forEach(client => {
              try { client.send(msg); } catch (_) { wsClients.delete(client); }
            });
          };

          runEvaluation(run, normalizedScope, body.options ?? {}, broadcastProgress).catch(err => {
            console.error(`[evaluations] Run ${run.id} failed:`, err);
          });

          return new Response(JSON.stringify(run), {
            status: 202,
            headers: { ...headers, 'Content-Type': 'application/json' },
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Invalid request' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' },
          });
        }
      }

      // GET /evaluations/config
      if (url.pathname === '/evaluations/config' && req.method === 'GET') {
        const llmAvailable = isAnyProviderConfigured();
        const available: string[] = ['tool_success'];
        if (llmAvailable) {
          available.push('transcript_quality', 'reasoning_quality');
        }
        available.push('regression');

        const config: EvalConfig = {
          api_key_configured: llmAvailable,
          available_evaluators: available as any,
          configured_providers: getConfiguredProviders(),
          providers: getProviderList(),
        };
        return new Response(JSON.stringify(config), {
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }

      // GET /evaluations/summary
      if (url.pathname === '/evaluations/summary' && req.method === 'GET') {
        const summary = getEvalSummary();
        return new Response(JSON.stringify(summary), {
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }

      // GET /evaluations/runs
      if (url.pathname === '/evaluations/runs' && req.method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const evaluator_type = url.searchParams.get('evaluator_type') || undefined;
        const status = url.searchParams.get('status') || undefined;
        const runs = listEvalRuns({ limit, evaluator_type, status });
        return new Response(JSON.stringify(runs), {
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }

      // GET /evaluations/runs/:id
      if (url.pathname.match(/^\/evaluations\/runs\/\d+$/) && req.method === 'GET') {
        const id = parseInt(url.pathname.split('/')[3]);
        const run = getEvalRun(id);
        if (!run) {
          return new Response(JSON.stringify({ error: 'Run not found' }), {
            status: 404,
            headers: { ...headers, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(run), {
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }

      // GET /evaluations/runs/:id/results
      if (url.pathname.match(/^\/evaluations\/runs\/\d+\/results$/) && req.method === 'GET') {
        const id = parseInt(url.pathname.split('/')[3]);
        const run = getEvalRun(id);
        if (!run) {
          return new Response(JSON.stringify({ error: 'Run not found' }), {
            status: 404,
            headers: { ...headers, 'Content-Type': 'application/json' },
          });
        }
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const include_rationale = url.searchParams.get('include_rationale') !== 'false';
        const results = getEvalResults(id, { limit, offset, include_rationale });
        return new Response(JSON.stringify(results), {
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }

      // DELETE /evaluations/runs/:id
      if (url.pathname.match(/^\/evaluations\/runs\/\d+$/) && req.method === 'DELETE') {
        const id = parseInt(url.pathname.split('/')[3]);
        const deleted = deleteEvalRun(id);
        if (!deleted) {
          return new Response(JSON.stringify({ error: 'Run not found' }), {
            status: 404,
            headers: { ...headers, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ deleted: true }), {
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }

      // WebSocket upgrade
      if (url.pathname === '/stream') {
        const success = server.upgrade(req);
        if (success) return undefined;
      }

      return new Response('Multi-Agent Observability Server', {
        headers: { ...headers, 'Content-Type': 'text/plain' },
      });
    },

    websocket: {
      open(ws) {
        wsClients.add(ws);
        const events = getRecentEvents(300);
        ws.send(JSON.stringify({ type: 'initial', data: events }));
      },
      message(_ws, message) {
        console.log('Received message:', message);
      },
      close(ws) {
        wsClients.delete(ws);
      },
      error(ws) {
        wsClients.delete(ws);
      },
    },
  });

  return server;
}

if (import.meta.main) {
  const server = createServer();
  console.log(`Server running on http://localhost:${server.port}`);
  console.log(`WebSocket endpoint: ws://localhost:${server.port}/stream`);
  console.log(`POST events to: http://localhost:${server.port}/events`);
}
