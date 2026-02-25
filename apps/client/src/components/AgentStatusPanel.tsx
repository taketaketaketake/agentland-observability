import { useState, useEffect } from 'react';
import type { HookEvent } from '../types';
import { useAgentStatus, type AgentStatus } from '../hooks/useAgentStatus';
import { useEventColors } from '../hooks/useEventColors';

interface AgentStatusPanelProps {
  events: HookEvent[];
  onSelectAgent: (agentName: string) => void;
  onViewTranscript?: (sessionId: string, agentId: string) => void;
}

function formatTimeSince(ms: number): string {
  if (ms < 1000) return 'now';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; glow: string }> = {
  active: { label: 'ACTIVE', color: 'var(--theme-accent-success)', glow: 'rgba(0, 229, 160, 0.15)' },
  idle: { label: 'IDLE', color: 'var(--theme-accent-warning)', glow: 'rgba(255, 178, 36, 0.12)' },
  stopped: { label: 'STOPPED', color: 'var(--theme-text-tertiary)', glow: 'transparent' },
};

export default function AgentStatusPanel({ events, onSelectAgent, onViewTranscript }: AgentStatusPanelProps) {
  const agents = useAgentStatus(events);
  const { getHexColorForApp } = useEventColors();
  const [, setTick] = useState(0);

  // Update time-since-last-event every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--theme-border-primary)]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-semibold tracking-widest uppercase text-[var(--theme-text-tertiary)]">
            Agents
          </span>
          {agents.length > 0 && (
            <span className="text-[10px] font-mono text-[var(--theme-text-quaternary)] bg-[var(--theme-bg-tertiary)] px-1.5 py-0.5 rounded">
              {agents.length}
            </span>
          )}
        </div>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto py-1.5">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-8 h-8 rounded-full border border-dashed border-[var(--theme-border-secondary)] flex items-center justify-center mb-3">
              <svg className="w-3.5 h-3.5 text-[var(--theme-text-quaternary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <span className="text-[11px] text-[var(--theme-text-tertiary)]">No agents connected</span>
            <span className="text-[10px] text-[var(--theme-text-quaternary)] mt-0.5">Start a Claude session to begin</span>
          </div>
        ) : (
          agents.map((agent, i) => {
            const config = STATUS_CONFIG[agent.status];
            const accentColor = getHexColorForApp(agent.sourceApp);

            return (
              <button
                key={agent.agentId}
                onClick={() => onSelectAgent(agent.sourceApp)}
                className="w-full text-left px-3 py-2 hover:bg-[var(--theme-hover-bg)] transition-all duration-150 group"
                style={{ animationDelay: `${i * 50}ms` }}
                title={`Click to toggle swim lane for ${agent.sourceApp}`}
              >
                <div
                  className="rounded-lg border p-2.5 transition-all duration-200 group-hover:border-[var(--theme-border-tertiary)]"
                  style={{
                    borderColor: agent.status === 'active' ? `${accentColor}33` : 'var(--theme-border-primary)',
                    background: agent.status === 'active' ? `${accentColor}08` : 'var(--theme-bg-surface)',
                    boxShadow: agent.status === 'active' ? `0 0 20px -5px ${accentColor}20` : 'none',
                  }}
                >
                  {/* Status row */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="relative flex h-2 w-2 flex-shrink-0">
                      {agent.status === 'active' && (
                        <span
                          className="status-pulse absolute inline-flex h-full w-full rounded-full opacity-50"
                          style={{ backgroundColor: config.color }}
                        />
                      )}
                      <span
                        className="relative inline-flex rounded-full h-2 w-2"
                        style={{ backgroundColor: config.color }}
                      />
                    </span>
                    <span
                      className="text-[9px] font-mono font-semibold tracking-widest uppercase"
                      style={{ color: config.color }}
                    >
                      {config.label}
                    </span>
                    <span className="ml-auto text-[10px] font-mono text-[var(--theme-text-quaternary)] tabular-nums">
                      {formatTimeSince(agent.timeSinceLastEvent)}
                    </span>
                  </div>

                  {/* Agent ID */}
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className="w-1 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: accentColor }}
                    />
                    <span className="text-xs font-mono font-medium text-[var(--theme-text-primary)] truncate">
                      {agent.agentId}
                    </span>
                  </div>

                  {/* Summary + count */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-[var(--theme-text-tertiary)] truncate flex-1">
                      {agent.lastSummary}
                    </span>
                    <span className="text-[9px] font-mono text-[var(--theme-text-quaternary)] flex-shrink-0 tabular-nums">
                      {agent.eventCount}
                    </span>
                  </div>

                  {/* Transcript button */}
                  {onViewTranscript && (
                    <div className="mt-1.5 pt-1.5 border-t border-[var(--theme-border-primary)]">
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewTranscript(agent.sessionId, agent.agentId);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.stopPropagation();
                            onViewTranscript(agent.sessionId, agent.agentId);
                          }
                        }}
                        className="inline-flex items-center gap-1 text-[9px] font-mono text-[var(--theme-text-quaternary)] hover:text-[var(--theme-primary)] transition-colors cursor-pointer"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        VIEW TRANSCRIPT
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
