import { useState, useEffect, useCallback, useRef } from 'react';
import type { Filters, TimeRange } from './types';
import { useWebSocket } from './hooks/useWebSocket';
import { useEventColors } from './hooks/useEventColors';
import EventTimeline from './components/EventTimeline';
import FilterPanel from './components/FilterPanel';
import StickScrollButton from './components/StickScrollButton';
import LivePulseChart from './components/LivePulseChart';
import ThemeManager from './components/ThemeManager';
import ToastNotification from './components/ToastNotification';
import AgentSwimLaneContainer from './components/AgentSwimLaneContainer';
import AgentStatusPanel from './components/AgentStatusPanel';
import { WS_URL } from './config';

interface Toast {
  id: number;
  agentName: string;
  agentColor: string;
}

export default function App() {
  const { events, isConnected, error, clearEvents } = useWebSocket(WS_URL);
  const { getHexColorForApp } = useEventColors();

  const [filters, setFilters] = useState<Filters>({ sourceApp: '', sessionId: '', eventType: '' });
  const [stickToBottom, setStickToBottom] = useState(true);
  const [showThemeManager, setShowThemeManager] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [uniqueAppNames, setUniqueAppNames] = useState<string[]>([]);
  const [allAppNames, setAllAppNames] = useState<string[]>([]);
  const [selectedAgentLanes, setSelectedAgentLanes] = useState<string[]>([]);
  const [, setCurrentTimeRange] = useState<TimeRange>('1m');

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

  return (
    <div className="h-screen flex flex-col bg-[var(--theme-bg-secondary)]">
      {/* Header */}
      <header className="short:hidden bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary-light)] shadow-lg border-b-2 border-[var(--theme-primary-dark)]">
        <div className="px-3 py-4 mobile:py-1.5 mobile:px-2 flex items-center justify-between mobile:gap-2">
          {/* Title */}
          <div className="mobile:hidden">
            <h1 className="text-2xl font-bold text-white drop-shadow-lg">
              Multi-Agent Observability
            </h1>
          </div>

          {/* Connection Status */}
          <div className="flex items-center space-x-1.5">
            {isConnected ? (
              <div className="flex items-center space-x-1.5">
                <span className="relative flex h-3 w-3 mobile:h-2 mobile:w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 mobile:h-2 mobile:w-2 bg-green-500" />
                </span>
                <span className="text-base mobile:text-xs text-white font-semibold drop-shadow-md mobile:hidden">
                  Connected
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5">
                <span className="relative flex h-3 w-3 mobile:h-2 mobile:w-2">
                  <span className="relative inline-flex rounded-full h-3 w-3 mobile:h-2 mobile:w-2 bg-red-500" />
                </span>
                <span className="text-base mobile:text-xs text-white font-semibold drop-shadow-md mobile:hidden">
                  Disconnected
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2 mobile:space-x-1">
            <span className="text-base mobile:text-xs text-white font-semibold drop-shadow-md bg-[var(--theme-primary-dark)] px-3 py-1.5 mobile:px-2 mobile:py-0.5 rounded-full border border-white/30">
              {events.length}
            </span>

            <button
              onClick={handleClear}
              className="p-3 mobile:p-1 rounded-lg bg-white/20 hover:bg-white/30 transition-all duration-200 border border-white/30 hover:border-white/50 backdrop-blur-sm shadow-lg hover:shadow-xl"
              title="Clear events"
            >
              <span className="text-2xl mobile:text-base">{'\u{1F5D1}\uFE0F'}</span>
            </button>

            <button
              onClick={() => setShowFilters((v) => !v)}
              className="p-3 mobile:p-1 rounded-lg bg-white/20 hover:bg-white/30 transition-all duration-200 border border-white/30 hover:border-white/50 backdrop-blur-sm shadow-lg hover:shadow-xl"
              title={showFilters ? 'Hide filters' : 'Show filters'}
            >
              <span className="text-2xl mobile:text-base">{'\u{1F4CA}'}</span>
            </button>

            <button
              onClick={() => setShowThemeManager(true)}
              className="p-3 mobile:p-1 rounded-lg bg-white/20 hover:bg-white/30 transition-all duration-200 border border-white/30 hover:border-white/50 backdrop-blur-sm shadow-lg hover:shadow-xl"
              title="Open theme manager"
            >
              <span className="text-2xl mobile:text-base">{'\u{1F3A8}'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Filters */}
      {showFilters && (
        <FilterPanel filters={filters} onFiltersChange={setFilters} />
      )}

      {/* Live Pulse Chart */}
      <LivePulseChart
        events={events}
        filters={filters}
        onUpdateUniqueApps={setUniqueAppNames}
        onUpdateAllApps={setAllAppNames}
        onUpdateTimeRange={setCurrentTimeRange}
      />

      {/* Agent Status Cards */}
      <AgentStatusPanel events={events} onSelectAgent={toggleAgentLane} />

      {/* Agent Swim Lanes */}
      {selectedAgentLanes.length > 0 && (
        <div className="w-full bg-[var(--theme-bg-secondary)] px-3 py-4 mobile:px-2 mobile:py-2 overflow-hidden">
          <AgentSwimLaneContainer
            selectedAgents={selectedAgentLanes}
            events={events}
            timeRange="1m"
            onUpdateSelectedAgents={setSelectedAgentLanes}
          />
        </div>
      )}

      {/* Timeline */}
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

      {/* Stick to bottom button */}
      <StickScrollButton
        stickToBottom={stickToBottom}
        onToggle={() => setStickToBottom((v) => !v)}
      />

      {/* Error message */}
      {error && (
        <div className="fixed bottom-4 left-4 mobile:bottom-3 mobile:left-3 mobile:right-3 bg-red-100 border border-red-400 text-red-700 px-3 py-2 mobile:px-2 mobile:py-1.5 rounded mobile:text-xs">
          {error}
        </div>
      )}

      {/* Theme Manager */}
      <ThemeManager isOpen={showThemeManager} onClose={() => setShowThemeManager(false)} />

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
    </div>
  );
}
