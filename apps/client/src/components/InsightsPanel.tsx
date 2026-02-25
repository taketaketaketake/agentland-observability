import type { HookEvent } from '../types';
import { useInsightsData } from '../hooks/useInsightsData';
import DonutChart from './charts/DonutChart';
import AreaChart from './charts/AreaChart';
import BarChart from './charts/BarChart';

interface InsightsPanelProps {
  events: HookEvent[];
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

export default function InsightsPanel({ events }: InsightsPanelProps) {
  const insights = useInsightsData(events);
  const { kpis } = insights;

  if (events.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-[var(--theme-text-quaternary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm text-[var(--theme-text-tertiary)] font-mono">Waiting for events to generate insights...</p>
          <p className="text-xs text-[var(--theme-text-quaternary)] font-mono mt-1">Data will appear as agents send events</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 mobile:p-3">
      {/* ─── KPI Row ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <KpiCard label="Total Events" value={kpis.totalEvents.toLocaleString()} />
        <KpiCard label="Agents" value={kpis.totalAgents.toString()} />
        <KpiCard label="Active" value={kpis.activeAgents.toString()} accent="var(--theme-accent-success)" />
        <KpiCard label="Events/Agent" value={kpis.avgEventsPerAgent.toString()} />
        <KpiCard label="Events/Min" value={kpis.eventsPerMinute.toString()} />
        <KpiCard label="Avg Duration" value={formatDuration(kpis.sessionDurationAvgMs)} />
        <KpiCard label="Top Event" value={kpis.topEventType} small />
        <KpiCard label="Top Tool" value={kpis.topTool} small />
      </div>

      {/* ─── Charts Grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Event Timeline — spans 2 cols */}
        <ChartCard title="Event Volume" className="lg:col-span-2 xl:col-span-2">
          <AreaChart
            data={insights.eventTimeline}
            width={600}
            height={160}
            color="#6a9fd8"
            title="Events over time"
          />
        </ChartCard>

        {/* Event Type Breakdown */}
        <ChartCard title="Event Types">
          <div className="flex justify-center py-2">
            <DonutChart
              data={insights.eventTypeBreakdown}
              size={150}
              strokeWidth={24}
              title="By type"
            />
          </div>
        </ChartCard>

        {/* Tool Usage Donut */}
        <ChartCard title="Tool Usage">
          <div className="flex justify-center py-2">
            <DonutChart
              data={insights.toolUsageBreakdown}
              size={150}
              strokeWidth={24}
              title="By tool"
            />
          </div>
        </ChartCard>

        {/* Top Tools Bar */}
        <ChartCard title="Tool Rankings">
          <BarChart
            data={insights.topToolsRanking}
            width={340}
            height={220}
            title="Most used tools"
          />
        </ChartCard>

        {/* Agent Activity */}
        <ChartCard title="Agent Activity">
          <BarChart
            data={insights.agentActivity}
            width={340}
            height={220}
            title="Events by agent"
          />
        </ChartCard>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function KpiCard({
  label,
  value,
  accent,
  small,
}: {
  label: string;
  value: string;
  accent?: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)] px-3 py-2.5">
      <div className="text-[10px] font-mono text-[var(--theme-text-tertiary)] uppercase tracking-wider mb-1">
        {label}
      </div>
      <div
        className={`font-semibold tabular-nums ${small ? 'text-xs' : 'text-lg'} truncate`}
        style={{ color: accent || 'var(--theme-text-primary)' }}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  className = '',
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)] p-4 ${className}`}
    >
      <h3 className="text-xs font-mono text-[var(--theme-text-tertiary)] uppercase tracking-wider mb-3">
        {title}
      </h3>
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}
