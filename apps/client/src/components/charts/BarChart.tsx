import { useState } from 'react';
import type { BarItem } from '../../types';

interface BarChartProps {
  data: BarItem[];
  width?: number;
  height?: number;
  title?: string;
}

export default function BarChart({ data, width = 300, height = 200, title }: BarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const padding = { top: 4, right: 8, bottom: 4, left: 8 };
  const barAreaW = width - padding.left - padding.right;

  const maxVal = Math.max(...data.map((d) => d.value), 1);

  if (data.length === 0) {
    return (
      <div className="flex flex-col gap-2 w-full">
        {title && <span className="text-xs font-mono text-[var(--theme-text-tertiary)] uppercase tracking-wider">{title}</span>}
        <div className="flex items-center justify-center border border-[var(--theme-border-primary)] rounded-md h-24">
          <span className="text-xs text-[var(--theme-text-quaternary)] font-mono">No data</span>
        </div>
      </div>
    );
  }

  const barHeight = 22;
  const gap = 4;
  const labelWidth = 80;
  const valueWidth = 36;
  const trackWidth = barAreaW - labelWidth - valueWidth - 8;
  const svgHeight = Math.max(height, data.length * (barHeight + gap) + padding.top + padding.bottom);

  return (
    <div className="flex flex-col gap-2 w-full">
      {title && (
        <span className="text-xs font-mono text-[var(--theme-text-tertiary)] uppercase tracking-wider">
          {title}
        </span>
      )}
      <svg
        viewBox={`0 0 ${width} ${svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full"
        style={{ maxHeight: svgHeight }}
      >
        {data.map((item, i) => {
          const y = padding.top + i * (barHeight + gap);
          const barW = (item.value / maxVal) * trackWidth;
          const isHovered = hovered === i;

          return (
            <g
              key={i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-default"
            >
              {/* Label */}
              <text
                x={padding.left}
                y={y + barHeight / 2 + 3}
                fill={isHovered ? 'var(--theme-text-primary)' : 'var(--theme-text-secondary)'}
                fontSize={10}
                fontFamily="'JetBrains Mono', monospace"
              >
                {item.label.length > 12 ? `${item.label.slice(0, 12)}...` : item.label}
              </text>

              {/* Hover tooltip */}
              {isHovered && item.label.length > 12 && (
                <>
                  <rect
                    x={padding.left}
                    y={y - 16}
                    width={item.label.length * 6 + 8}
                    height={14}
                    rx={2}
                    fill="var(--theme-bg-quaternary)"
                    stroke="var(--theme-border-secondary)"
                    strokeWidth={0.5}
                  />
                  <text
                    x={padding.left + 4}
                    y={y - 6}
                    fill="var(--theme-text-primary)"
                    fontSize={9}
                    fontFamily="'JetBrains Mono', monospace"
                  >
                    {item.label}
                  </text>
                </>
              )}

              {/* Track */}
              <rect
                x={padding.left + labelWidth}
                y={y}
                width={trackWidth}
                height={barHeight}
                rx={3}
                fill="var(--theme-bg-tertiary)"
              />

              {/* Bar */}
              <rect
                x={padding.left + labelWidth}
                y={y}
                width={Math.max(barW, 2)}
                height={barHeight}
                rx={3}
                fill={item.color}
                opacity={isHovered ? 1 : 0.8}
                className="transition-opacity duration-150"
              />

              {/* Value */}
              <text
                x={padding.left + labelWidth + trackWidth + 6}
                y={y + barHeight / 2 + 3}
                fill={isHovered ? 'var(--theme-text-primary)' : 'var(--theme-text-tertiary)'}
                fontSize={10}
                fontFamily="'JetBrains Mono', monospace"
                fontWeight={isHovered ? 600 : 400}
              >
                {item.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
