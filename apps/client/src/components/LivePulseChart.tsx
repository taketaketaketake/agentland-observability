import { useRef, useEffect, useState, useCallback } from 'react';
import type { HookEvent, TimeRange } from '../types';
import { useChartData } from '../hooks/useChartData';
import { ChartRenderer } from '../utils/chartRenderer';

interface LivePulseChartProps {
  events: HookEvent[];
  filters: { sourceApp: string; sessionId: string; eventType: string };
  onUpdateUniqueApps: (apps: string[]) => void;
  onUpdateAllApps: (apps: string[]) => void;
  onUpdateTimeRange: (range: TimeRange) => void;
}

const TIME_RANGES: TimeRange[] = ['1m', '3m', '5m', '10m'];

export default function LivePulseChart({
  events,
  onUpdateUniqueApps,
  onUpdateAllApps,
  onUpdateTimeRange,
}: LivePulseChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ChartRenderer | null>(null);
  const animFrameRef = useRef<number>(0);
  const [timeRange, setTimeRange] = useState<TimeRange>('1m');

  const { chartData, uniqueApps, allApps } = useChartData(events, timeRange);

  // Propagate to parent
  useEffect(() => { onUpdateUniqueApps(uniqueApps); }, [uniqueApps, onUpdateUniqueApps]);
  useEffect(() => { onUpdateAllApps(allApps); }, [allApps, onUpdateAllApps]);

  const handleTimeRangeChange = useCallback((range: TimeRange) => {
    setTimeRange(range);
    onUpdateTimeRange(range);
  }, [onUpdateTimeRange]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateSize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);

      if (!rendererRef.current) {
        rendererRef.current = new ChartRenderer(canvas);
      }
      rendererRef.current.resize(rect.width, rect.height);
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Render loop
  useEffect(() => {
    const render = () => {
      if (rendererRef.current) {
        rendererRef.current.render(chartData);
      }
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [chartData]);

  // Count totals for current data
  const totalEvents = chartData.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="bg-[var(--theme-bg-primary)] border-b border-[var(--theme-border-primary)]">
      {/* Controls bar */}
      <div className="flex items-center justify-between px-3 py-1.5 mobile:px-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--theme-text-secondary)]">
            {'\u{1F4CA}'} Live
          </span>
          <span className="text-xs text-[var(--theme-text-tertiary)]">
            {totalEvents} events | {uniqueApps.length} agents
          </span>
        </div>

        {/* Time range selector */}
        <div className="flex items-center gap-1">
          {TIME_RANGES.map((range) => (
            <button
              key={range}
              onClick={() => handleTimeRangeChange(range)}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                timeRange === range
                  ? 'bg-[var(--theme-primary)] text-white'
                  : 'bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-quaternary)]'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas chart */}
      <div className="h-24 mobile:h-16 px-1">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </div>
  );
}
