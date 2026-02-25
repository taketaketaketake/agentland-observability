import { useState } from 'react';
import type { HookEvent } from '../types';
import { useAgentStatus, type AgentStatus } from '../hooks/useAgentStatus';
import { useEventColors } from '../hooks/useEventColors';

interface AgentStatusPanelProps {
  events: HookEvent[];
  onSelectAgent: (agentName: string) => void;
}

function formatTimeSince(ms: number): string {
  if (ms < 1000) return 'just now';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

const STATUS_CONFIG: Record<AgentStatus, { dot: string; label: string; dotClass: string }> = {
  active: { dot: '', label: 'Active', dotClass: 'bg-green-500' },
  idle: { dot: '', label: 'Idle', dotClass: 'bg-amber-400' },
  stopped: { dot: '', label: 'Stopped', dotClass: 'bg-gray-400' },
};

export default function AgentStatusPanel({ events, onSelectAgent }: AgentStatusPanelProps) {
  const agents = useAgentStatus(events);
  const { getHexColorForApp } = useEventColors();
  const [collapsed, setCollapsed] = useState(false);

  if (agents.length === 0) return null;

  return (
    <div className="bg-[var(--theme-bg-primary)] border-b border-[var(--theme-border-primary)]">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[var(--theme-text-secondary)] hover:bg-[var(--theme-hover-bg)] transition-colors"
      >
        <span className="text-[10px]">{collapsed ? '\u25B6' : '\u25BC'}</span>
        <span>Agents ({agents.length})</span>
      </button>

      {/* Cards */}
      {!collapsed && (
        <div className="flex gap-2 px-3 pb-2 overflow-x-auto">
          {agents.map((agent) => {
            const config = STATUS_CONFIG[agent.status];
            const borderColor = getHexColorForApp(agent.sourceApp);

            return (
              <button
                key={agent.agentId}
                onClick={() => onSelectAgent(agent.sourceApp)}
                className="flex-shrink-0 rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)] hover:bg-[var(--theme-hover-bg)] transition-colors text-left px-3 py-2 min-w-[240px] max-w-[320px]"
                style={{ borderLeftColor: borderColor, borderLeftWidth: 3 }}
                title={`Click to toggle swim lane for ${agent.sourceApp}`}
              >
                {/* Top row: status dot + agent ID + event count */}
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2 flex-shrink-0">
                    {agent.status === 'active' && (
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dotClass} opacity-75`} />
                    )}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotClass}`} />
                  </span>
                  <span className="text-xs font-mono font-medium text-[var(--theme-text-primary)] truncate">
                    {agent.agentId}
                  </span>
                  <span className="ml-auto text-[10px] text-[var(--theme-text-quaternary)] flex-shrink-0">
                    {agent.eventCount} events
                  </span>
                </div>

                {/* Bottom row: summary + time */}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] text-[var(--theme-text-tertiary)] truncate flex-1">
                    {agent.lastSummary}
                  </span>
                  <span className="text-[10px] text-[var(--theme-text-quaternary)] flex-shrink-0">
                    {formatTimeSince(agent.timeSinceLastEvent)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
