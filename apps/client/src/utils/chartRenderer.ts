import type { ChartDataPoint } from '../types';

interface ChartTheme {
  primary: string;
  glow: string;
  axis: string;
  text: string;
  barColors: string[];
}

const DEFAULT_THEME: ChartTheme = {
  primary: '#6366f1',
  glow: 'rgba(99, 102, 241, 0.4)',
  axis: '#e2e8f0',
  text: '#94a3b8',
  barColors: [
    '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4',
  ],
};

export class ChartRenderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private theme: ChartTheme;
  private padding = { top: 10, right: 10, bottom: 24, left: 32 };

  constructor(canvas: HTMLCanvasElement, theme?: Partial<ChartTheme>) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2D context');
    this.ctx = ctx;
    this.width = canvas.width;
    this.height = canvas.height;
    this.theme = { ...DEFAULT_THEME, ...theme };
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  render(data: ChartDataPoint[]) {
    const { ctx, width, height, padding, theme } = this;

    // Clear
    ctx.clearRect(0, 0, width, height);

    if (data.length === 0) return;

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const barWidth = Math.max(2, (chartWidth / data.length) - 2);
    const gap = 2;

    // Find max count for scaling
    const maxCount = Math.max(1, ...data.map(d => d.count));

    // Draw axis lines
    ctx.strokeStyle = theme.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Draw bars
    data.forEach((point, i) => {
      const x = padding.left + i * (barWidth + gap);
      const barHeight = (point.count / maxCount) * chartHeight;
      const y = height - padding.bottom - barHeight;

      if (point.count === 0) return;

      // Glow effect
      ctx.shadowColor = theme.glow;
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Draw stacked bar segments by event type
      const eventTypes = Object.entries(point.eventTypes);
      let yOffset = 0;

      if (eventTypes.length <= 1) {
        // Single color bar
        ctx.fillStyle = theme.primary;
        ctx.fillRect(x, y, barWidth, barHeight);
      } else {
        // Stacked bar
        eventTypes.forEach(([, count], colorIdx) => {
          const segmentHeight = (count / point.count) * barHeight;
          ctx.fillStyle = theme.barColors[colorIdx % theme.barColors.length]!;
          ctx.fillRect(x, y + yOffset, barWidth, segmentHeight);
          yOffset += segmentHeight;
        });
      }

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    });

    // Draw time labels
    ctx.fillStyle = theme.text;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';

    const labelCount = Math.min(6, data.length);
    const labelInterval = Math.floor(data.length / labelCount);

    for (let i = 0; i < data.length; i += labelInterval) {
      const point = data[i]!;
      const x = padding.left + i * (barWidth + gap) + barWidth / 2;
      const date = new Date(point.timestamp);
      const label = `${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
      ctx.fillText(label, x, height - 4);
    }

    // Draw Y-axis labels
    ctx.textAlign = 'right';
    ctx.fillText(String(maxCount), padding.left - 4, padding.top + 10);
    ctx.fillText('0', padding.left - 4, height - padding.bottom);
  }
}
