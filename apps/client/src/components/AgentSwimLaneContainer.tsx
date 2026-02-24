import { useMemo } from 'react';
import type { HookEvent, TimeRange } from '../types';
import { useEventColors } from '../hooks/useEventColors';
import { useEventEmojis } from '../hooks/useEventEmojis';

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
        <span className="text-xs font-semibold text-[var(--theme-text-secondary)] uppercase tracking-wide">
          Agent Swim Lanes
        </span>
        <button
          onClick={() => onUpdateSelectedAgents([])}
          className="text-xs text-[var(--theme-accent-error)] hover:underline"
        >
          Clear all
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {selectedAgents.map((agent) => {
          const color = getHexColorForApp(agent);
          const agentEvts = agentEvents[agent] || [];

          return (
            <div
              key={agent}
              className="flex-shrink-0 w-64 rounded-lg border bg-[var(--theme-bg-primary)] overflow-hidden"
              style={{ borderColor: color, borderTopWidth: 3 }}
            >
              {/* Lane header */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--theme-bg-secondary)]">
                <span className="text-xs font-semibold truncate" style={{ color }}>
                  {agent}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[var(--theme-text-tertiary)]">
                    {agentEvts.length}
                  </span>
                  <button
                    onClick={() => removeAgent(agent)}
                    className="text-xs text-[var(--theme-text-tertiary)] hover:text-[var(--theme-accent-error)]"
                  >
                    {'\u2715'}
                  </button>
                </div>
              </div>

              {/* Lane events */}
              <div className="max-h-32 overflow-y-auto">
                {agentEvts.length === 0 ? (
                  <div className="text-center text-[10px] text-[var(--theme-text-quaternary)] py-3">
                    No events in window
                  </div>
                ) : (
                  agentEvts.slice(-20).map((evt) => (
                    <div
                      key={evt.id || evt.timestamp}
                      className="flex items-center gap-1 px-2 py-0.5 text-[10px] border-b border-[var(--theme-border-primary)] last:border-b-0"
                    >
                      <span>{getEventEmoji(evt.hook_event_type)}</span>
                      <span className="text-[var(--theme-text-secondary)] truncate">
                        {evt.hook_event_type}
                        {evt.payload?.tool_name ? `: ${evt.payload.tool_name}` : ''}
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
