import type { ChartDataPoint } from '../types';

interface ChartTheme {
  primary: string;
  glow: string;
  axis: string;
  text: string;
  gridLine: string;
  barColors: string[];
}

const DEFAULT_THEME: ChartTheme = {
  primary: '#00e5a0',
  glow: 'rgba(0, 229, 160, 0.35)',
  axis: 'rgba(255, 255, 255, 0.06)',
  text: 'rgba(255, 255, 255, 0.25)',
  gridLine: 'rgba(255, 255, 255, 0.03)',
  barColors: [
    '#00e5a0', '#58a6ff', '#ffb224', '#ff6b6b', '#bc8cff',
    '#ff9eb7', '#79c0ff', '#56d364', '#f97316', '#06b6d4',
  ],
};

export class ChartRenderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private theme: ChartTheme;
  private padding = { top: 8, right: 8, bottom: 20, left: 28 };

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

    // Clear with transparent
    ctx.clearRect(0, 0, width, height);

    if (data.length === 0) return;

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const barWidth = Math.max(2, (chartWidth / data.length) - 1.5);
    const gap = 1.5;

    // Find max count for scaling
    const maxCount = Math.max(1, ...data.map(d => d.count));

    // Draw horizontal grid lines
    ctx.strokeStyle = theme.gridLine;
    ctx.lineWidth = 1;
    const gridLines = 3;
    for (let i = 1; i <= gridLines; i++) {
      const y = padding.top + (chartHeight / (gridLines + 1)) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // Draw baseline
    ctx.strokeStyle = theme.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Draw bars
    data.forEach((point, i) => {
      const x = padding.left + i * (barWidth + gap);
      const barHeight = (point.count / maxCount) * chartHeight;
      const y = height - padding.bottom - barHeight;

      if (point.count === 0) return;

      // Draw stacked bar segments by event type
      const eventTypes = Object.entries(point.eventTypes);
      let yOffset = 0;

      // Glow under bars
      ctx.shadowColor = theme.glow;
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;

      if (eventTypes.length <= 1) {
        ctx.fillStyle = theme.primary;
        // Rounded top corners for single bars
        const radius = Math.min(2, barWidth / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, y + barHeight);
        ctx.lineTo(x, y + barHeight);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.fill();
      } else {
        eventTypes.forEach(([, count], colorIdx) => {
          const segmentHeight = (count / point.count) * barHeight;
          ctx.fillStyle = theme.barColors[colorIdx % theme.barColors.length]!;
          if (colorIdx === 0) {
            // First segment (top) — rounded corners
            const radius = Math.min(2, barWidth / 2);
            ctx.beginPath();
            ctx.moveTo(x + radius, y + yOffset);
            ctx.lineTo(x + barWidth - radius, y + yOffset);
            ctx.quadraticCurveTo(x + barWidth, y + yOffset, x + barWidth, y + yOffset + radius);
            ctx.lineTo(x + barWidth, y + yOffset + segmentHeight);
            ctx.lineTo(x, y + yOffset + segmentHeight);
            ctx.lineTo(x, y + yOffset + radius);
            ctx.quadraticCurveTo(x, y + yOffset, x + radius, y + yOffset);
            ctx.fill();
          } else {
            ctx.fillRect(x, y + yOffset, barWidth, segmentHeight);
          }
          yOffset += segmentHeight;
        });
      }

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    });

    // Draw time labels
    ctx.fillStyle = theme.text;
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = 'center';

    const labelCount = Math.min(5, data.length);
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
