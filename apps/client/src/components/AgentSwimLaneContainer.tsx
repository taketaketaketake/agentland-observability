import { useMemo } from 'react';
import type { HookEvent, TimeRange } from '../types';
import { useEventColors } from '../hooks/useEventColors';
import { useEventEmojis } from '../hooks/useEventEmojis';
import { getEventSummary } from '../utils/eventSummary';

interface AgentSwimLaneContainerProps {
  selectedAgents: string[];
  events: HookEvent[];
  timeRange: TimeRange;
  onUpdateSelectedAgents: (agents: string[]) => void;
}

const TIME_RANGE_MS: Record<TimeRange, number> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '10m': 600_000,
};

export default function AgentSwimLaneContainer({
  selectedAgents,
  events,
  timeRange,
  onUpdateSelectedAgents,
}: AgentSwimLaneContainerProps) {
  const { getHexColorForApp } = useEventColors();
  const { getEventEmoji } = useEventEmojis();

  const agentEvents = useMemo(() => {
    const now = Date.now();
    const rangeMs = TIME_RANGE_MS[timeRange];
    const startTime = now - rangeMs;

    const grouped: Record<string, HookEvent[]> = {};
    for (const agent of selectedAgents) {
      grouped[agent] = events.filter(
        (e) => e.source_app === agent && (e.timestamp || 0) >= startTime
      );
    }
    return grouped;
  }, [selectedAgents, events, timeRange]);

  const removeAgent = (agent: string) => {
    onUpdateSelectedAgents(selectedAgents.filter((a) => a !== agent));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono font-semibold tracking-widest uppercase text-[var(--theme-text-tertiary)]">
          Swim Lanes
        </span>
        <button
          onClick={() => onUpdateSelectedAgents([])}
          className="text-[10px] font-mono text-[var(--theme-accent-error)] hover:underline"
        >
          Clear all
        </button>
      </div>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${selectedAgents.length}, minmax(0, 1fr))` }}
      >
        {selectedAgents.map((agent) => {
          const color = getHexColorForApp(agent);
          const agentEvts = agentEvents[agent] || [];

          return (
            <div
              key={agent}
              className="min-w-0 rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-bg-primary)] overflow-hidden"
              style={{ borderTopColor: color, borderTopWidth: 2 }}
            >
              {/* Lane header */}
              <div className="flex items-center justify-between px-2.5 py-1.5 bg-[var(--theme-bg-surface)]">
                <span className="text-[10px] font-mono font-semibold truncate" style={{ color }}>
                  {agent}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono text-[var(--theme-text-quaternary)] tabular-nums">
                    {agentEvts.length}
                  </span>
                  <button
                    onClick={() => removeAgent(agent)}
                    className="text-[var(--theme-text-quaternary)] hover:text-[var(--theme-accent-error)] transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Lane events */}
              <div className="max-h-28 overflow-y-auto">
                {agentEvts.length === 0 ? (
                  <div className="text-center text-[9px] font-mono text-[var(--theme-text-quaternary)] py-3">
                    No events in window
                  </div>
                ) : (
                  agentEvts.slice(-20).map((evt) => (
                    <div
                      key={evt.id || evt.timestamp}
                      className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono border-b border-[var(--theme-border-primary)] last:border-b-0 hover:bg-[var(--theme-hover-bg)] transition-colors"
                    >
                      <span className="text-xs">{getEventEmoji(evt.hook_event_type)}</span>
                      <span className="text-[var(--theme-text-tertiary)] truncate">
                        {getEventSummary(evt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
