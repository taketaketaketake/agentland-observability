interface ToolStats {
  success: number;
  failure: number;
  rate: number;
}

interface SuccessRateChartProps {
  data: Record<string, ToolStats>;
  title?: string;
}

export default function SuccessRateChart({ data, title }: SuccessRateChartProps) {
  const entries = Object.entries(data).sort((a, b) => (b[1].success + b[1].failure) - (a[1].success + a[1].failure));

  if (entries.length === 0) {
    return (
      <div className="text-xs text-[var(--theme-text-quaternary)] font-mono text-center py-4">
        No tool data
      </div>
    );
  }

  const maxTotal = Math.max(...entries.map(([, v]) => v.success + v.failure));

  return (
    <div>
      {title && (
        <div className="text-[10px] font-mono text-[var(--theme-text-tertiary)] uppercase tracking-wider mb-2">
          {title}
        </div>
      )}
      <div className="space-y-1.5">
        {entries.slice(0, 12).map(([name, stats]) => {
          const total = stats.success + stats.failure;
          const barWidth = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
          const successWidth = total > 0 ? (stats.success / total) * 100 : 0;

          return (
            <div key={name} className="flex items-center gap-2">
              <div className="w-20 text-[11px] font-mono text-[var(--theme-text-secondary)] truncate" title={name}>
                {name}
              </div>
              <div className="flex-1 h-4 bg-[var(--theme-bg-primary)] rounded-sm overflow-hidden relative" style={{ width: `${barWidth}%` }}>
                <div
                  className="h-full rounded-sm"
                  style={{
                    width: `${successWidth}%`,
                    backgroundColor: 'var(--theme-accent-success)',
                    opacity: 0.7,
                  }}
                />
                {stats.failure > 0 && (
                  <div
                    className="h-full rounded-sm absolute top-0"
                    style={{
                      left: `${successWidth}%`,
                      width: `${100 - successWidth}%`,
                      backgroundColor: 'var(--theme-accent-error)',
                      opacity: 0.7,
                    }}
                  />
                )}
              </div>
              <div className="w-16 text-right text-[11px] font-mono tabular-nums text-[var(--theme-text-tertiary)]">
                {(stats.rate * 100).toFixed(0)}% <span className="text-[var(--theme-text-quaternary)]">({total})</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
