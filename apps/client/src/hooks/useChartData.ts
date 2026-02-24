import { useMemo } from 'react';
import type { HookEvent, TimeRange, ChartDataPoint } from '../types';

const TIME_RANGE_MS: Record<TimeRange, number> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '10m': 600_000,
};

const BUCKET_COUNTS: Record<TimeRange, number> = {
  '1m': 30,
  '3m': 45,
  '5m': 50,
  '10m': 60,
};

export function useChartData(events: HookEvent[], timeRange: TimeRange) {
  const chartData = useMemo(() => {
    const now = Date.now();
    const rangeMs = TIME_RANGE_MS[timeRange];
    const bucketCount = BUCKET_COUNTS[timeRange];
    const bucketSize = rangeMs / bucketCount;
    const startTime = now - rangeMs;

    // Initialize empty buckets
    const buckets: ChartDataPoint[] = Array.from({ length: bucketCount }, (_, i) => ({
      timestamp: startTime + i * bucketSize,
      count: 0,
      eventTypes: {},
      toolEvents: {},
      sessions: {},
    }));

    // Fill buckets
    for (const event of events) {
      const ts = event.timestamp || 0;
      if (ts < startTime || ts > now) continue;

      const bucketIndex = Math.min(
        Math.floor((ts - startTime) / bucketSize),
        bucketCount - 1
      );
      const bucket = buckets[bucketIndex]!;
      bucket.count++;

      // Track event types
      const eventType = event.hook_event_type;
      bucket.eventTypes[eventType] = (bucket.eventTypes[eventType] || 0) + 1;

      // Track tool events
      const toolName = event.payload?.tool_name;
      if (toolName) {
        const key = `${eventType}:${toolName}`;
        bucket.toolEvents![key] = (bucket.toolEvents![key] || 0) + 1;
      }

      // Track sessions
      const sessionKey = `${event.source_app}:${event.session_id}`;
      bucket.sessions[sessionKey] = (bucket.sessions[sessionKey] || 0) + 1;
    }

    return buckets;
  }, [events, timeRange]);

  // Unique agents in the current time window
  const uniqueApps = useMemo(() => {
    const now = Date.now();
    const rangeMs = TIME_RANGE_MS[timeRange];
    const startTime = now - rangeMs;
    const apps = new Set<string>();

    for (const event of events) {
      const ts = event.timestamp || 0;
      if (ts >= startTime && ts <= now) {
        apps.add(event.source_app);
      }
    }

    return Array.from(apps);
  }, [events, timeRange]);

  // All agents ever seen
  const allApps = useMemo(() => {
    const apps = new Set<string>();
    for (const event of events) {
      apps.add(event.source_app);
    }
    return Array.from(apps);
  }, [events]);

  return { chartData, uniqueApps, allApps };
}
