import { useState, useEffect, useCallback, useRef } from 'react';
import type { Filters, TimeRange } from './types';
import { useWebSocket } from './hooks/useWebSocket';
import { useEventColors } from './hooks/useEventColors';
import { useAgentStatus } from './hooks/useAgentStatus';
import EventTimeline from './components/EventTimeline';
import FilterPanel from './components/FilterPanel';
import StickScrollButton from './components/StickScrollButton';
import LivePulseChart from './components/LivePulseChart';
import ToastNotification from './components/ToastNotification';
import AgentSwimLaneContainer from './components/AgentSwimLaneContainer';
import AgentStatusPanel from './components/AgentStatusPanel';
import InsightsPanel from './components/InsightsPanel';
import SessionTranscriptPanel from './components/SessionTranscriptPanel';
import { WS_URL } from './config';

type DashboardTab = 'live' | 'insights';

interface Toast {
  id: number;
  agentName: string;
  agentColor: string;
}

export default function App() {
  const { events, isConnected, error, clearEvents } = useWebSocket(WS_URL);
  const { getHexColorForApp } = useEventColors();
  const agents = useAgentStatus(events);

  const [filters, setFilters] = useState<Filters>({ sourceApp: '', sessionId: '', eventType: '' });
  const [stickToBottom, setStickToBottom] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [uniqueAppNames, setUniqueAppNames] = useState<string[]>([]);
  const [allAppNames, setAllAppNames] = useState<string[]>([]);
  const [selectedAgentLanes, setSelectedAgentLanes] = useState<string[]>([]);
  const [, setCurrentTimeRange] = useState<TimeRange>('1m');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>('live');
  const [transcriptSession, setTranscriptSession] = useState<{ sessionId: string; agentId: string } | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const seenAgentsRef = useRef(new Set<string>());

  // Watch for new agents and show toast
  useEffect(() => {
    uniqueAppNames.forEach((appName) => {
      if (!seenAgentsRef.current.has(appName)) {
        seenAgentsRef.current.add(appName);
        const toast: Toast = {
          id: toastIdRef.current++,
          agentName: appName,
          agentColor: getHexColorForApp(appName),
        };
        setToasts((prev) => [...prev, toast]);
      }
    });
  }, [uniqueAppNames, getHexColorForApp]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toggleAgentLane = useCallback((agentName: string) => {
    setSelectedAgentLanes((prev) => {
      const index = prev.indexOf(agentName);
      if (index >= 0) {
        return prev.filter((a) => a !== agentName);
      }
      return [...prev, agentName];
    });
  }, []);

  const handleClear = useCallback(() => {
    clearEvents();
    setSelectedAgentLanes([]);
  }, [clearEvents]);

  const handleViewTranscript = useCallback((sessionId: string, agentId: string) => {
    setTranscriptSession({ sessionId, agentId });
  }, []);

  const activeCount = agents.filter(a => a.status === 'active').length;
  const idleCount = agents.filter(a => a.status === 'idle').length;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--theme-bg-primary)]">
      {/* ─── Top Command Bar ─── */}
      <header className="short:hidden flex-shrink-0 border-b border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)]">
        <div className="flex items-center justify-between px-4 py-2.5 mobile:px-3 mobile:py-2">
          {/* Left: Logo + Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-[var(--theme-primary)] animate-live-blink" />
              <h1 className="text-sm font-semibold tracking-tight text-[var(--theme-text-primary)]" style={{ fontFamily: "'Outfit', sans-serif" }}>
                OBSERVABILITY
              </h1>
            </div>

            {/* Connection indicator */}
            <div className={`flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-full border ${
              isConnected
                ? 'text-[var(--theme-accent-success)] border-[rgba(109,186,130,0.2)] bg-[rgba(109,186,130,0.06)]'
                : 'text-[var(--theme-accent-error)] border-[rgba(201,96,96,0.2)] bg-[rgba(201,96,96,0.06)]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-[var(--theme-accent-success)]' : 'bg-[var(--theme-accent-error)]'}`} />
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </div>

            {/* Tab Switcher */}
            <div className="flex items-center rounded-md border border-[var(--theme-border-primary)] bg-[var(--theme-bg-primary)] p-0.5">
              <TabButton active={activeTab === 'live'} onClick={() => setActiveTab('live')}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Live
              </TabButton>
              <TabButton active={activeTab === 'insights'} onClick={() => setActiveTab('insights')}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Insights
              </TabButton>
            </div>
          </div>

          {/* Center: Stats */}
          <div className="hidden sm:flex items-center gap-3">
            <StatPill label="Events" value={events.length} />
            <StatPill label="Active" value={activeCount} color="var(--theme-accent-success)" />
            {idleCount > 0 && <StatPill label="Idle" value={idleCount} color="var(--theme-accent-warning)" />}
            <StatPill label="Agents" value={agents.length} color="var(--theme-accent-info)" />
          </div>

          {/* Right: Actions (Live-tab controls) */}
          <div className="flex items-center gap-1.5">
            {activeTab === 'live' && (
              <>
                <HeaderButton
                  onClick={() => setSidebarOpen(v => !v)}
                  active={sidebarOpen}
                  title="Toggle agents panel"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                </HeaderButton>
                <HeaderButton
                  onClick={() => setShowFilters(v => !v)}
                  active={showFilters}
                  title="Toggle filters"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </HeaderButton>
              </>
            )}
            <HeaderButton onClick={handleClear} title="Clear events">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </HeaderButton>
          </div>
        </div>
      </header>

      {/* ─── Filters Bar (Live tab only) ─── */}
      {activeTab === 'live' && showFilters && (
        <FilterPanel filters={filters} onFiltersChange={setFilters} />
      )}

      {/* ─── Main Content ─── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ─── Sidebar: Agent Panel (Live tab only) ─── */}
        {activeTab === 'live' && sidebarOpen && (
          <aside className="w-64 mobile:w-56 flex-shrink-0 border-r border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)] flex flex-col overflow-hidden">
            <AgentStatusPanel events={events} onSelectAgent={toggleAgentLane} onViewTranscript={handleViewTranscript} />
          </aside>
        )}

        {/* ─── Main Area ─── */}
        {activeTab === 'live' ? (
          <main className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Chart */}
            <LivePulseChart
              events={events}
              filters={filters}
              onUpdateUniqueApps={setUniqueAppNames}
              onUpdateAllApps={setAllAppNames}
              onUpdateTimeRange={setCurrentTimeRange}
            />

            {/* Swim Lanes */}
            {selectedAgentLanes.length > 0 && (
              <div className="flex-shrink-0 border-b border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)] px-4 py-3 mobile:px-3 mobile:py-2 overflow-hidden">
                <AgentSwimLaneContainer
                  selectedAgents={selectedAgentLanes}
                  events={events}
                  timeRange="1m"
                  onUpdateSelectedAgents={setSelectedAgentLanes}
                />
              </div>
            )}

            {/* Event Feed */}
            <div className="flex flex-col flex-1 overflow-hidden">
              <EventTimeline
                events={events}
                filters={filters}
                uniqueAppNames={uniqueAppNames}
                allAppNames={allAppNames}
                stickToBottom={stickToBottom}
                onStickToBottomChange={setStickToBottom}
                onSelectAgent={toggleAgentLane}
              />
            </div>
          </main>
        ) : (
          <main className="flex-1 flex flex-col overflow-hidden min-w-0">
            <InsightsPanel events={events} />
          </main>
        )}
      </div>

      {/* ─── Floating Controls (Live tab only) ─── */}
      {activeTab === 'live' && (
        <StickScrollButton
          stickToBottom={stickToBottom}
          onToggle={() => setStickToBottom((v) => !v)}
        />
      )}

      {/* Error bar */}
      {error && (
        <div className="fixed bottom-4 left-4 mobile:bottom-3 mobile:left-3 mobile:right-3 z-50 flex items-center gap-2 px-3 py-2 rounded-lg border border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.1)] backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-accent-error)]" />
          <span className="text-xs font-mono text-[var(--theme-accent-error)]">{error}</span>
        </div>
      )}

      {/* Toast Notifications */}
      {toasts.map((toast, index) => (
        <ToastNotification
          key={toast.id}
          index={index}
          agentName={toast.agentName}
          agentColor={toast.agentColor}
          onDismiss={() => dismissToast(toast.id)}
        />
      ))}

      {/* Transcript Panel */}
      {transcriptSession && (
        <SessionTranscriptPanel
          sessionId={transcriptSession.sessionId}
          agentId={transcriptSession.agentId}
          onClose={() => setTranscriptSession(null)}
        />
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function StatPill({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-mono">
      <span className="text-[var(--theme-text-tertiary)] uppercase text-[10px] tracking-wider">{label}</span>
      <span
        className="font-semibold tabular-nums"
        style={{ color: color || 'var(--theme-text-primary)' }}
      >
        {value}
      </span>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono transition-all duration-150 ${
        active
          ? 'bg-[var(--theme-primary-glow-strong)] text-[var(--theme-primary)]'
          : 'text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-secondary)]'
      }`}
    >
      {children}
    </button>
  );
}

function HeaderButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition-all duration-150 ${
        active
          ? 'text-[var(--theme-primary)] bg-[var(--theme-primary-glow)]'
          : 'text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-tertiary)]'
      }`}
    >
      {children}
    </button>
  );
}
