# Custom Insights Dashboard — Implementation Plan

## Phase 1: Foundation
- [x] `useInsightsData` hook + `InsightsData` types in `types.ts`
- [x] Validation: `npx tsc --noEmit` passes

## Phase 2: SVG Chart Components
- [x] `DonutChart` — interactive donut with hover, legend, center label
- [x] `AreaChart` — responsive SVG area chart with tooltips, grid, time labels
- [x] `BarChart` — horizontal bar chart with hover highlights and truncated label tooltips
- [x] Validation: `npx vite build` succeeds, no new deps in bundle

## Phase 3: InsightsPanel + KPI Cards
- [x] `InsightsPanel` component with 8 KPI cards + chart grid
- [x] Empty state for zero events
- [x] Validation: build succeeds

## Phase 4: Dashboard View Switcher
- [x] `TabButton` component for Live/Insights toggle
- [x] Tab switcher in App.tsx header
- [x] Live tab renders current dashboard (untouched)
- [x] Insights tab renders InsightsPanel as full view
- [x] Live-only controls (sidebar, filters, stick-scroll) hidden on Insights tab
- [x] Validation: build succeeds

## Phase 5: Polish & Verify
- [x] Charts use responsive `viewBox` + `preserveAspectRatio` (scales to container)
- [x] Proper empty states on all chart components
- [x] Hover tooltips on BarChart for truncated labels
- [x] AreaChart tooltip shows "N evts" format
- [x] Unique gradient IDs via `useId()` to prevent SVG conflicts
- [x] Clean build, zero new dependencies

## Build Size Comparison
| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| JS (gzip) | 71.50 KB | 75.02 KB | +3.52 KB |
| CSS (gzip) | 6.18 KB | 6.32 KB | +0.14 KB |
| Modules | 47 | 52 | +5 |
| Dependencies | react, react-dom | react, react-dom | 0 new |
