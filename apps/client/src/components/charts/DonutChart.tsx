import { useState } from 'react';
import type { DonutSlice } from '../../types';

interface DonutChartProps {
  data: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  title?: string;
}

export default function DonutChart({ data, size = 160, strokeWidth = 28, title }: DonutChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-2">
        {title && <span className="text-xs font-mono text-[var(--theme-text-tertiary)] uppercase tracking-wider">{title}</span>}
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={(size - strokeWidth) / 2}
            fill="none"
            stroke="var(--theme-border-primary)"
            strokeWidth={strokeWidth}
          />
        </svg>
        <span className="text-xs text-[var(--theme-text-quaternary)]">No data</span>
      </div>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Build arcs
  let accumulated = 0;
  const arcs = data.map((slice, i) => {
    const fraction = slice.value / total;
    const dashLength = fraction * circumference;
    const dashOffset = -accumulated * circumference + circumference * 0.25; // start at top
    accumulated += fraction;

    return {
      slice,
      index: i,
      dashLength,
      dashOffset,
      fraction,
    };
  });

  const hoveredArc = hovered !== null ? arcs[hovered] : null;

  return (
    <div className="flex flex-col items-center gap-2">
      {title && (
        <span className="text-xs font-mono text-[var(--theme-text-tertiary)] uppercase tracking-wider">
          {title}
        </span>
      )}
      <div className="relative">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-0"
        >
          {arcs.map(({ slice, index, dashLength, dashOffset }) => (
            <circle
              key={index}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={hovered === index ? strokeWidth + 4 : strokeWidth}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={dashOffset}
              className="transition-all duration-150"
              style={{ opacity: hovered !== null && hovered !== index ? 0.4 : 1 }}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {hoveredArc ? (
            <>
              <span className="text-lg font-semibold tabular-nums text-[var(--theme-text-primary)]">
                {Math.round(hoveredArc.fraction * 100)}%
              </span>
              <span className="text-[10px] font-mono text-[var(--theme-text-tertiary)] max-w-[60px] truncate text-center">
                {hoveredArc.slice.label}
              </span>
            </>
          ) : (
            <>
              <span className="text-lg font-semibold tabular-nums text-[var(--theme-text-primary)]">{total}</span>
              <span className="text-[10px] font-mono text-[var(--theme-text-tertiary)]">total</span>
            </>
          )}
        </div>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 max-w-[200px]">
        {data.slice(0, 6).map((slice, i) => (
          <div
            key={i}
            className="flex items-center gap-1 cursor-default"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="w-2 h-2 rounded-sm flex-shrink-0"
              style={{ backgroundColor: slice.color }}
            />
            <span className="text-[10px] font-mono text-[var(--theme-text-secondary)] truncate max-w-[70px]">
              {slice.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
