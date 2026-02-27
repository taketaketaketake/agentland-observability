import { useMemo } from 'react';
import type { HookEvent } from '../types';
import { getEventSummary } from '../utils/eventSummary';

export type AgentStatus = 'active' | 'idle' | 'stopped';

export interface AgentInfo {
  /** project_name:truncated_session_id */
  agentId: string;
  sourceApp: string;
  sessionId: string;
  projectName: string;
  status: AgentStatus;
  lastSummary: string;
  lastEvent: HookEvent;
  eventCount: number;
  /** Milliseconds since last event */
  timeSinceLastEvent: number;
}

const IDLE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const VISIBILITY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

const STOP_EVENT_TYPES = new Set(['SessionEnd', 'Stop', 'SubagentStop']);

export function useAgentStatus(events: HookEvent[]): AgentInfo[] {
  return useMemo(() => {
    const now = Date.now();
    const cutoff = now - VISIBILITY_WINDOW_MS;

    // Group events by composite key: source_app + session_id
    const agentMap = new Map<string, { events: HookEvent[]; sourceApp: string; sessionId: string; projectName: string }>();

    for (const event of events) {
      const truncatedSession = event.session_id.substring(0, 8);
      const key = `${event.source_app}:${truncatedSession}`;

      let entry = agentMap.get(key);
      if (!entry) {
        // Derive project name from cwd (last path segment)
        const cwd = event.payload?.cwd || '';
        const projectName = cwd ? (() => { const parts = cwd.replace(/\\/g, '/').split('/'); const idx = parts.indexOf('github-projects'); return idx >= 0 && idx + 1 < parts.length ? parts[idx + 1] : parts.pop() || cwd; })() : '';
        entry = { events: [], sourceApp: event.source_app, sessionId: event.session_id, projectName };
        agentMap.set(key, entry);
      }
      entry.events.push(event);
    }

    const agents: AgentInfo[] = [];

    for (const [agentId, { events: agentEvents, sourceApp, sessionId, projectName }] of agentMap) {
      // Find the most recent event by timestamp
      let lastEvent = agentEvents[0]!;
      for (const e of agentEvents) {
        if ((e.timestamp || 0) > (lastEvent.timestamp || 0)) {
          lastEvent = e;
        }
      }

      const lastTimestamp = lastEvent.timestamp || now;
      const timeSinceLastEvent = now - lastTimestamp;

      // Skip agents with no events in the visibility window
      if (lastTimestamp < cutoff) continue;

      // Derive status
      let status: AgentStatus;
      if (STOP_EVENT_TYPES.has(lastEvent.hook_event_type)) {
        status = 'stopped';
      } else if (timeSinceLastEvent > IDLE_THRESHOLD_MS) {
        status = 'idle';
      } else {
        status = 'active';
      }

      // Use project name in display ID if available
      const displayId = projectName
        ? `${projectName}:${sessionId.substring(0, 8)}`
        : agentId;

      agents.push({
        agentId: displayId,
        sourceApp,
        sessionId,
        projectName,
        status,
        lastSummary: getEventSummary(lastEvent),
        lastEvent,
        eventCount: agentEvents.length,
        timeSinceLastEvent,
      });
    }

    // Sort: active first, then idle, then stopped
    const statusOrder: Record<AgentStatus, number> = { active: 0, idle: 1, stopped: 2 };
    agents.sort((a, b) => {
      const orderDiff = statusOrder[a.status] - statusOrder[b.status];
      if (orderDiff !== 0) return orderDiff;
      // Within same status, most recently active first
      return a.timeSinceLastEvent - b.timeSinceLastEvent;
    });

    return agents;
  }, [events]);
}
