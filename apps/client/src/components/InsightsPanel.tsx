import { useState } from 'react';
import type { HookEvent, HistoricalInsightsResponse, AreaPoint, BarItem, DonutSlice } from '../types';
import { useInsightsData } from '../hooks/useInsightsData';
import { useHistoricalInsights } from '../hooks/useHistoricalInsights';
import { useCrossSessionInsights } from '../hooks/useCrossSessionInsights';
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

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatScore(n: number | null): string {
  if (n === null) return '--';
  return `${(n * 100).toFixed(1)}%`;
}

const HOUR_COLORS = [
  '#4a6fa5', '#5a7fb5', '#6a8fc5', '#7a9fd5',
  '#8aafe5', '#7ab5e5', '#6abbd5', '#5ac1c5',
  '#4ac7b5', '#5acd95', '#6ad375', '#7ad965',
  '#8adf55', '#9ae545', '#aaeb45', '#bae155',
  '#cad765', '#dacd75', '#e5c385', '#d5b995',
  '#c5afa5', '#b5a5b5', '#a59bc5', '#9591d5',
];

export default function InsightsPanel({ events }: InsightsPanelProps) {
  const [view, setView] = useState<'live' | 'historical' | 'ai'>('live');
  const insights = useInsightsData(events);
  const { kpis } = insights;

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {/* ─── Sub-tab Toggle ─── */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-1">
        <SubTabButton active={view === 'live'} onClick={() => setView('live')}>
          Live
        </SubTabButton>
        <SubTabButton active={view === 'historical'} onClick={() => setView('historical')}>
          Historical
        </SubTabButton>
        <SubTabButton active={view === 'ai'} onClick={() => setView('ai')}>
          AI Insights
        </SubTabButton>
      </div>

      {view === 'live' ? (
        <LiveInsights events={events} insights={insights} kpis={kpis} />
      ) : view === 'historical' ? (
        <HistoricalInsights />
      ) : (
        <AIInsights />
      )}
    </div>
  );
}

/* ─── Live Insights (existing) ─── */

function LiveInsights({
  events,
  insights,
  kpis,
}: {
  events: HookEvent[];
  insights: ReturnType<typeof useInsightsData>;
  kpis: ReturnType<typeof useInsightsData>['kpis'];
}) {
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

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <ChartCard title="Event Volume" className="lg:col-span-2 xl:col-span-2">
          <AreaChart data={insights.eventTimeline} width={600} height={160} color="#6a9fd8" title="Events over time" />
        </ChartCard>
        <ChartCard title="Event Types">
          <div className="flex justify-center py-2">
            <DonutChart data={insights.eventTypeBreakdown} size={150} strokeWidth={24} title="By type" />
          </div>
        </ChartCard>
        <ChartCard title="Tool Usage">
          <div className="flex justify-center py-2">
            <DonutChart data={insights.toolUsageBreakdown} size={150} strokeWidth={24} title="By tool" />
          </div>
        </ChartCard>
        <ChartCard title="Tool Rankings">
          <BarChart data={insights.topToolsRanking} width={340} height={220} title="Most used tools" />
        </ChartCard>
        <ChartCard title="Agent Activity">
          <BarChart data={insights.agentActivity} width={340} height={220} title="Events by agent" />
        </ChartCard>
      </div>
    </div>
  );
}

/* ─── Historical Insights ─── */

function HistoricalInsights() {
  const { data, loading, error } = useHistoricalInsights();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-[var(--theme-text-tertiary)] font-mono animate-pulse">Loading historical data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-[var(--theme-text-tertiary)] font-mono">Failed to load: {error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { kpis } = data;

  // Transform data for charts
  const sessionVolumeData: AreaPoint[] = data.session_volume.map(d => ({
    timestamp: new Date(d.day).getTime(),
    value: d.session_count,
  }));

  const activityByHourData: BarItem[] = data.activity_by_hour.map(d => ({
    label: `${d.hour}:00`,
    value: d.event_count,
    color: HOUR_COLORS[d.hour % 24] ?? '#6a9fd8',
  }));

  const qualityTrendData: AreaPoint[] = data.quality_trend.map(d => ({
    timestamp: d.timestamp,
    value: d.avg_score,
  }));

  const tokenSplitData: DonutSlice[] = buildTokenSplit(data);

  const toolReliabilityData: BarItem[] = data.tool_reliability.map(d => {
    const rate = d.total_count > 0 ? d.success_count / d.total_count : 0;
    return {
      label: d.tool_name,
      value: Math.round(rate * 100),
      color: rate >= 0.95 ? '#4ade80' : rate >= 0.8 ? '#facc15' : '#f87171',
    };
  });

  const modelColors = ['#6a9fd8', '#a78bfa', '#f59e0b', '#34d399', '#f87171', '#818cf8', '#fb923c', '#22d3ee'];
  const tokensByModelData: BarItem[] = data.token_by_model.map((d, i) => ({
    label: d.model.length > 20 ? d.model.slice(0, 18) + '..' : d.model,
    value: d.total_tokens,
    color: modelColors[i % modelColors.length]!,
  }));

  return (
    <div className="flex-1 overflow-y-auto p-4 mobile:p-3">
      {/* ─── KPI Row ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <KpiCard label="Sessions" value={kpis.total_sessions.toLocaleString()} />
        <KpiCard label="Messages" value={kpis.total_messages.toLocaleString()} />
        <KpiCard label="Msgs/Session" value={kpis.avg_messages_per_session.toLocaleString()} />
        <KpiCard label="Total Tokens" value={formatTokens(kpis.total_tokens)} />
        <KpiCard label="Avg Quality" value={formatScore(kpis.avg_quality_score)} accent={kpis.avg_quality_score !== null ? 'var(--theme-accent-success)' : undefined} />
        <KpiCard label="Tool Success" value={`${kpis.tool_success_rate}%`} accent="var(--theme-accent-success)" />
        <KpiCard label="Models Used" value={kpis.unique_models.toString()} />
        <KpiCard label="Active Days" value={kpis.active_days.toString()} />
      </div>

      {/* ─── Charts Grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Sessions Over Time */}
        <ChartCard title="Sessions Over Time (30d)" className="lg:col-span-2 xl:col-span-2">
          <AreaChart data={sessionVolumeData} width={600} height={160} color="#6a9fd8" title="Daily session counts" />
        </ChartCard>

        {/* Activity by Hour */}
        <ChartCard title="Activity by Hour">
          <BarChart data={activityByHourData} width={340} height={220} title="Events by hour of day" />
        </ChartCard>

        {/* Quality Trends */}
        <ChartCard title="Quality Trends" className="lg:col-span-2 xl:col-span-2">
          {qualityTrendData.length > 0 ? (
            <AreaChart data={qualityTrendData} width={600} height={160} color="#a78bfa" title="Avg eval score per run" />
          ) : (
            <div className="flex items-center justify-center h-[160px]">
              <p className="text-xs text-[var(--theme-text-quaternary)] font-mono">Run evaluations to see trends</p>
            </div>
          )}
        </ChartCard>

        {/* Token Split */}
        <ChartCard title="Token Split">
          <div className="flex justify-center py-2">
            <DonutChart data={tokenSplitData} size={150} strokeWidth={24} title="Input vs Output" />
          </div>
        </ChartCard>

        {/* Tool Reliability */}
        <ChartCard title="Tool Reliability (Success %)">
          <BarChart data={toolReliabilityData} width={340} height={220} title="Top tools by success rate" />
        </ChartCard>

        {/* Tokens by Model */}
        <ChartCard title="Tokens by Model">
          <BarChart data={tokensByModelData} width={340} height={220} title="Total tokens per model" />
        </ChartCard>
      </div>
    </div>
  );
}

/* ─── AI Insights ─── */

const OUTCOME_CHART_COLORS: Record<string, string> = {
  success: '#4ade80',
  partial: '#facc15',
  failure: '#f87171',
  abandoned: '#94a3b8',
  unclear: '#60a5fa',
};

function AIInsights() {
  const { data, loading, error } = useCrossSessionInsights();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-[var(--theme-text-tertiary)] font-mono">
          <div className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin" />
          Synthesizing AI insights...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-[var(--theme-text-tertiary)] font-mono">Failed to load: {error}</p>
      </div>
    );
  }

  if (!data) return null;

  // Error states from the server
  if (data.error === 'no_provider') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <svg className="w-10 h-10 mx-auto mb-3 text-[var(--theme-text-quaternary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
          </svg>
          <p className="text-sm text-[var(--theme-text-tertiary)] font-mono">No LLM provider configured</p>
          <p className="text-xs text-[var(--theme-text-quaternary)] mt-1">Set an API key (ANTHROPIC_API_KEY or GOOGLE_API_KEY) to enable AI insights</p>
        </div>
      </div>
    );
  }

  if (data.error === 'insufficient_data') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <svg className="w-10 h-10 mx-auto mb-3 text-[var(--theme-text-quaternary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
          </svg>
          <p className="text-sm text-[var(--theme-text-tertiary)] font-mono">Insufficient data</p>
          <p className="text-xs text-[var(--theme-text-quaternary)] mt-1">{data.message}</p>
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-[var(--theme-accent-error)] font-mono">{data.message || data.error}</p>
      </div>
    );
  }

  // Compute KPIs from the data
  const outcomeDistribution = data.outcome_distribution || {};
  const totalAnalyzed = Object.values(outcomeDistribution).reduce((s, n) => s + n, 0);
  const successCount = (outcomeDistribution['success'] || 0);
  const successRate = totalAnalyzed > 0 ? Math.round((successCount / totalAnalyzed) * 100) : 0;
  const qualityDist = data.quality_distribution || { high: 0, medium: 0, low: 0 };
  const qualityTotal = qualityDist.high + qualityDist.medium + qualityDist.low;
  const avgQuality = qualityTotal > 0 ? ((qualityDist.high * 4.5 + qualityDist.medium * 3 + qualityDist.low * 1.5) / qualityTotal).toFixed(1) : '--';
  const topCategory = Object.entries(data.task_categories || {}).sort((a, b) => b[1] - a[1])[0];

  // Chart data
  const outcomeDonut: DonutSlice[] = Object.entries(outcomeDistribution).map(([label, value]) => ({
    label,
    value,
    color: OUTCOME_CHART_COLORS[label] || '#6a9fd8',
  }));

  const categoryColors = ['#6a9fd8', '#a78bfa', '#f59e0b', '#34d399', '#f87171', '#818cf8', '#fb923c', '#22d3ee'];
  const categoryBar: BarItem[] = Object.entries(data.task_categories || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value], i) => ({
      label,
      value,
      color: categoryColors[i % categoryColors.length]!,
    }));

  return (
    <div className="flex-1 overflow-y-auto p-4 mobile:p-3">
      {/* ─── KPI Row ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Analyzed" value={totalAnalyzed.toString()} />
        <KpiCard label="Success Rate" value={`${successRate}%`} accent="var(--theme-accent-success)" />
        <KpiCard label="Avg Quality" value={avgQuality.toString()} accent="var(--theme-accent-success)" />
        <KpiCard label="Top Category" value={topCategory ? topCategory[0] : '--'} small />
      </div>

      {/* ─── Content Cards ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Overall Summary */}
        <ChartCard title="Overall Summary" className="lg:col-span-2 xl:col-span-3">
          <p className="text-xs text-[var(--theme-text-secondary)] leading-relaxed">{data.overall_summary}</p>
        </ChartCard>

        {/* Common Patterns */}
        {data.common_patterns.length > 0 && (
          <ChartCard title="Common Patterns">
            <ul className="space-y-1.5">
              {data.common_patterns.map((p, i) => (
                <li key={i} className="text-xs text-[var(--theme-text-secondary)] pl-2 border-l-2 border-blue-500/30">{p}</li>
              ))}
            </ul>
          </ChartCard>
        )}

        {/* Outcome Distribution */}
        {outcomeDonut.length > 0 && (
          <ChartCard title="Outcome Distribution">
            <div className="flex justify-center py-2">
              <DonutChart data={outcomeDonut} size={150} strokeWidth={24} title="By outcome" />
            </div>
          </ChartCard>
        )}

        {/* Task Categories */}
        {categoryBar.length > 0 && (
          <ChartCard title="Task Categories">
            <BarChart data={categoryBar} width={340} height={220} title="Sessions by category" />
          </ChartCard>
        )}

        {/* Recurring Issues */}
        {data.common_issues.length > 0 && (
          <ChartCard title="Recurring Issues">
            <ul className="space-y-1.5">
              {data.common_issues.map((issue, i) => (
                <li key={i} className="text-xs text-red-400/80 pl-2 border-l-2 border-red-500/20">{issue}</li>
              ))}
            </ul>
          </ChartCard>
        )}

        {/* Recommendations */}
        {data.recommendations.length > 0 && (
          <ChartCard title="Recommendations" className="lg:col-span-2">
            <ol className="space-y-1.5 list-decimal list-inside">
              {data.recommendations.map((rec, i) => (
                <li key={i} className="text-xs text-[var(--theme-text-secondary)]">{rec}</li>
              ))}
            </ol>
          </ChartCard>
        )}

        {/* Productivity Assessment */}
        {data.productivity_assessment && (
          <ChartCard title="Productivity">
            <p className="text-xs text-[var(--theme-text-secondary)] leading-relaxed">{data.productivity_assessment}</p>
          </ChartCard>
        )}
      </div>
    </div>
  );
}

function buildTokenSplit(data: HistoricalInsightsResponse): DonutSlice[] {
  const totalInput = data.token_by_model.reduce((s, d) => s + d.total_input, 0);
  const totalOutput = data.token_by_model.reduce((s, d) => s + d.total_output, 0);
  if (totalInput + totalOutput === 0) return [];
  return [
    { label: `Input (${formatTokens(totalInput)})`, value: totalInput, color: '#6a9fd8' },
    { label: `Output (${formatTokens(totalOutput)})`, value: totalOutput, color: '#a78bfa' },
  ];
}

/* ─── Sub-components ─── */

function SubTabButton({
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
      className={`px-2.5 py-1 rounded text-xs font-mono transition-all duration-150 ${
        active
          ? 'bg-[var(--theme-primary-glow-strong)] text-[var(--theme-primary)]'
          : 'text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-secondary)]'
      }`}
    >
      {children}
    </button>
  );
}

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
