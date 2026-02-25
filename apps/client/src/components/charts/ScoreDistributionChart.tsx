interface ScoreDistributionChartProps {
  scores: Record<string, number>;
  maxScore: number;
}

export default function ScoreDistributionChart({ scores, maxScore }: ScoreDistributionChartProps) {
  const entries = Object.entries(scores);

  if (entries.length === 0) {
    return (
      <div className="text-xs text-[var(--theme-text-quaternary)] font-mono text-center py-4">
        No scores
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map(([label, value]) => {
        const pct = maxScore > 0 ? (value / maxScore) * 100 : 0;
        const color = value >= 4 ? 'var(--theme-accent-success)' : value >= 3 ? 'var(--theme-accent-warning)' : 'var(--theme-accent-error)';

        return (
          <div key={label} className="flex items-center gap-2">
            <div className="w-24 text-[11px] font-mono text-[var(--theme-text-secondary)] truncate" title={label}>
              {label}
            </div>
            <div className="flex-1 h-3 bg-[var(--theme-bg-primary)] rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm transition-all duration-300"
                style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.7 }}
              />
            </div>
            <div className="w-8 text-right text-[11px] font-mono tabular-nums" style={{ color }}>
              {value.toFixed(1)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
