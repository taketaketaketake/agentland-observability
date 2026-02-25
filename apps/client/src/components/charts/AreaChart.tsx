import { useState, useCallback, useId } from 'react';
import type { AreaPoint } from '../../types';

interface AreaChartProps {
  data: AreaPoint[];
  width?: number;
  height?: number;
  color?: string;
  title?: string;
}

export default function AreaChart({
  data,
  width = 400,
  height = 140,
  color = '#6a9fd8',
  title,
}: AreaChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const gradId = useId();

  const padding = { top: 8, right: 8, bottom: 20, left: 32 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const minTs = data.length > 0 ? data[0]!.timestamp : 0;
  const maxTs = data.length > 0 ? data[data.length - 1]!.timestamp : 1;
  const tsSpan = maxTs - minTs || 1;

  const toX = useCallback(
    (ts: number) => padding.left + ((ts - minTs) / tsSpan) * chartW,
    [padding.left, minTs, tsSpan, chartW],
  );
  const toY = useCallback(
    (val: number) => padding.top + chartH - (val / maxVal) * chartH,
    [padding.top, chartH, maxVal],
  );

  if (data.length === 0) {
    return (
      <div className="flex flex-col gap-2 w-full">
        {title && <span className="text-xs font-mono text-[var(--theme-text-tertiary)] uppercase tracking-wider">{title}</span>}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full"
          style={{ maxHeight: height }}
        >
          <line
            x1={padding.left}
            y1={padding.top + chartH}
            x2={padding.left + chartW}
            y2={padding.top + chartH}
            stroke="var(--theme-border-primary)"
            strokeWidth={1}
          />
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            fill="var(--theme-text-quaternary)"
            fontSize={11}
            fontFamily="'JetBrains Mono', monospace"
          >
            No data
          </text>
        </svg>
      </div>
    );
  }

  // Build path
  const points = data.map((d) => ({ x: toX(d.timestamp), y: toY(d.value) }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1]!.x},${padding.top + chartH} L${points[0]!.x},${padding.top + chartH} Z`;

  // Y-axis ticks (3 ticks)
  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  // Format time label
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const hovered = hoveredIndex !== null ? data[hoveredIndex] : null;
  const hoveredPt = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div className="flex flex-col gap-2 w-full">
      {title && (
        <span className="text-xs font-mono text-[var(--theme-text-tertiary)] uppercase tracking-wider">
          {title}
        </span>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full overflow-visible"
        style={{ maxHeight: height }}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {/* Grid lines */}
        {yTicks.map((tick) => (
          <line
            key={tick}
            x1={padding.left}
            y1={toY(tick)}
            x2={padding.left + chartW}
            y2={toY(tick)}
            stroke="var(--theme-border-primary)"
            strokeWidth={1}
            strokeDasharray={tick > 0 ? '2,3' : undefined}
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((tick) => (
          <text
            key={tick}
            x={padding.left - 6}
            y={toY(tick) + 3}
            textAnchor="end"
            fill="var(--theme-text-quaternary)"
            fontSize={9}
            fontFamily="'JetBrains Mono', monospace"
          >
            {tick}
          </text>
        ))}

        {/* X-axis labels */}
        <text
          x={padding.left}
          y={height - 2}
          textAnchor="start"
          fill="var(--theme-text-quaternary)"
          fontSize={9}
          fontFamily="'JetBrains Mono', monospace"
        >
          {formatTime(minTs)}
        </text>
        <text
          x={padding.left + chartW}
          y={height - 2}
          textAnchor="end"
          fill="var(--theme-text-quaternary)"
          fontSize={9}
          fontFamily="'JetBrains Mono', monospace"
        >
          {formatTime(maxTs)}
        </text>

        {/* Gradient */}
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradId})`} />

        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />

        {/* Invisible hover targets */}
        {points.map((p, i) => (
          <rect
            key={i}
            x={p.x - chartW / data.length / 2}
            y={padding.top}
            width={chartW / data.length}
            height={chartH}
            fill="transparent"
            onMouseEnter={() => setHoveredIndex(i)}
          />
        ))}

        {/* Hover indicator */}
        {hovered && hoveredPt && (
          <>
            <line
              x1={hoveredPt.x}
              y1={padding.top}
              x2={hoveredPt.x}
              y2={padding.top + chartH}
              stroke="var(--theme-text-quaternary)"
              strokeWidth={1}
              strokeDasharray="2,2"
            />
            <circle cx={hoveredPt.x} cy={hoveredPt.y} r={3} fill={color} stroke="var(--theme-bg-primary)" strokeWidth={1.5} />
            <rect
              x={hoveredPt.x - 30}
              y={hoveredPt.y - 24}
              width={60}
              height={18}
              rx={3}
              fill="var(--theme-bg-quaternary)"
              stroke="var(--theme-border-secondary)"
              strokeWidth={0.5}
            />
            <text
              x={hoveredPt.x}
              y={hoveredPt.y - 12}
              textAnchor="middle"
              fill="var(--theme-text-primary)"
              fontSize={9}
              fontFamily="'JetBrains Mono', monospace"
            >
              {hovered.value} evt{hovered.value !== 1 ? 's' : ''}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
