import { initDatabase, insertEvent, getFilterOptions, getRecentEvents, updateEventHITLResponse, insertMessages, getSessionMessages, listTranscriptSessions } from './db';
import type { HookEvent, HumanInTheLoopResponse, TranscriptMessage } from './types';

initDatabase();

const wsClients = new Set<any>();

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

const server = Bun.serve({
  port: parseInt(process.env.SERVER_PORT || '4000'),

  async fetch(req: Request) {
    const url = new URL(req.url);

    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    // POST /events
    if (url.pathname === '/events' && req.method === 'POST') {
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

    // GET /transcripts (listing)
    if (url.pathname === '/transcripts' && req.method === 'GET') {
      const sessions = listTranscriptSessions();
      console.log(`[transcripts] GET /transcripts — ${sessions.length} sessions`);
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

console.log(`Server running on http://localhost:${server.port}`);
console.log(`WebSocket endpoint: ws://localhost:${server.port}/stream`);
console.log(`POST events to: http://localhost:${server.port}/events`);
