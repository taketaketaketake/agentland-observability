import { useMemo } from 'react';
import type { HookEvent, InsightsData, DonutSlice, AreaPoint, BarItem } from '../types';

const CHART_HEX_COLORS = [
  '#6a9fd8',
  '#6dba82',
  '#d4a04a',
  '#c96060',
  '#9b86c4',
  '#c4889b',
  '#5ba8a8',
  '#8bab5e',
];

function colorAt(i: number): string {
  return CHART_HEX_COLORS[i % CHART_HEX_COLORS.length]!;
}

export function useInsightsData(events: HookEvent[]): InsightsData {
  return useMemo(() => {
    const now = Date.now();

    // ── Agent grouping ──
    const agentEvents = new Map<string, HookEvent[]>();
    const eventTypeCounts = new Map<string, number>();
    const toolCounts = new Map<string, number>();

    for (const ev of events) {
      // Agent key
      const agentKey = `${ev.source_app}:${ev.session_id.substring(0, 8)}`;
      const list = agentEvents.get(agentKey);
      if (list) {
        list.push(ev);
      } else {
        agentEvents.set(agentKey, [ev]);
      }

      // Event type counts
      eventTypeCounts.set(
        ev.hook_event_type,
        (eventTypeCounts.get(ev.hook_event_type) || 0) + 1,
      );

      // Tool counts (from PreToolUse / PostToolUse)
      const toolName = ev.payload?.tool_name as string | undefined;
      if (toolName) {
        toolCounts.set(toolName, (toolCounts.get(toolName) || 0) + 1);
      }
    }

    const totalAgents = agentEvents.size;
    const totalEvents = events.length;

    // Active agents (last event within 2 min)
    const IDLE_THRESHOLD_MS = 2 * 60 * 1000;
    let activeAgents = 0;
    for (const [, evts] of agentEvents) {
      const lastTs = Math.max(...evts.map((e) => e.timestamp || 0));
      if (now - lastTs < IDLE_THRESHOLD_MS) activeAgents++;
    }

    // Average events per agent
    const avgEventsPerAgent = totalAgents > 0 ? Math.round(totalEvents / totalAgents) : 0;

    // Top event type
    let topEventType = '—';
    let topEventCount = 0;
    for (const [type, count] of eventTypeCounts) {
      if (count > topEventCount) {
        topEventCount = count;
        topEventType = type;
      }
    }

    // Top tool
    let topTool = '—';
    let topToolCount = 0;
    for (const [tool, count] of toolCounts) {
      if (count > topToolCount) {
        topToolCount = count;
        topTool = tool;
      }
    }

    // Events per minute (over the whole span of events)
    const timestamps = events
      .map((e) => e.timestamp || 0)
      .filter((t) => t > 0);
    let eventsPerMinute = 0;
    if (timestamps.length >= 2) {
      const minTs = Math.min(...timestamps);
      const maxTs = Math.max(...timestamps);
      const spanMin = (maxTs - minTs) / 60_000;
      eventsPerMinute = spanMin > 0 ? Math.round((totalEvents / spanMin) * 10) / 10 : 0;
    }

    // Avg session duration (time between first and last event per agent)
    let totalDuration = 0;
    let durCount = 0;
    for (const [, evts] of agentEvents) {
      const tss = evts.map((e) => e.timestamp || 0).filter((t) => t > 0);
      if (tss.length >= 2) {
        totalDuration += Math.max(...tss) - Math.min(...tss);
        durCount++;
      }
    }
    const sessionDurationAvgMs = durCount > 0 ? Math.round(totalDuration / durCount) : 0;

    // ── Donut: event type breakdown ──
    const eventTypeBreakdown: DonutSlice[] = Array.from(eventTypeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value], i) => ({ label, value, color: colorAt(i) }));

    // ── Donut: tool usage breakdown ──
    const toolUsageBreakdown: DonutSlice[] = Array.from(toolCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value], i) => ({ label, value, color: colorAt(i) }));

    // ── Area chart: events over time (30 buckets) ──
    const BUCKET_COUNT = 30;
    const sortedTs = timestamps.slice().sort((a, b) => a - b);
    const eventTimeline: AreaPoint[] = [];

    if (sortedTs.length > 0) {
      const minTs = sortedTs[0]!;
      const maxTs = sortedTs[sortedTs.length - 1]!;
      const span = Math.max(maxTs - minTs, 60_000); // at least 1 minute
      const bucketSize = span / BUCKET_COUNT;

      for (let i = 0; i < BUCKET_COUNT; i++) {
        eventTimeline.push({ timestamp: minTs + i * bucketSize, value: 0 });
      }

      for (const ts of sortedTs) {
        const idx = Math.min(
          Math.floor((ts - minTs) / bucketSize),
          BUCKET_COUNT - 1,
        );
        eventTimeline[idx]!.value++;
      }
    }

    // ── Bar chart: top tools ranking ──
    const topToolsRanking: BarItem[] = Array.from(toolCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value], i) => ({ label, value, color: colorAt(i) }));

    // ── Bar chart: agent activity ──
    const agentActivity: BarItem[] = Array.from(agentEvents.entries())
      .map(([key, evts]) => ({ label: key, value: evts.length }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .map((item, i) => ({ ...item, color: colorAt(i) }));

    return {
      kpis: {
        totalEvents,
        totalAgents,
        activeAgents,
        avgEventsPerAgent,
        topEventType,
        topTool,
        eventsPerMinute,
        sessionDurationAvgMs,
      },
      eventTypeBreakdown,
      toolUsageBreakdown,
      eventTimeline,
      topToolsRanking,
      agentActivity,
    };
  }, [events]);
}
