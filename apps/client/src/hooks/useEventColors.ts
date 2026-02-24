import { useCallback, useRef } from 'react';

// Deterministic hash
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

const SESSION_COLORS = [
  'bg-blue-100 text-blue-800 border-blue-300',
  'bg-green-100 text-green-800 border-green-300',
  'bg-purple-100 text-purple-800 border-purple-300',
  'bg-orange-100 text-orange-800 border-orange-300',
  'bg-pink-100 text-pink-800 border-pink-300',
  'bg-cyan-100 text-cyan-800 border-cyan-300',
  'bg-yellow-100 text-yellow-800 border-yellow-300',
  'bg-red-100 text-red-800 border-red-300',
  'bg-indigo-100 text-indigo-800 border-indigo-300',
  'bg-teal-100 text-teal-800 border-teal-300',
  'bg-lime-100 text-lime-800 border-lime-300',
  'bg-emerald-100 text-emerald-800 border-emerald-300',
  'bg-violet-100 text-violet-800 border-violet-300',
  'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300',
  'bg-rose-100 text-rose-800 border-rose-300',
  'bg-sky-100 text-sky-800 border-sky-300',
];

const APP_HUES = [
  210, 145, 270, 30, 330, 180, 60, 0, 240, 160, 90, 300, 45, 195, 120, 350,
];

export function useEventColors() {
  const appColorCache = useRef<Map<string, string>>(new Map());

  const getSessionColor = useCallback((sessionId: string): string => {
    const index = hashString(sessionId) % SESSION_COLORS.length;
    return SESSION_COLORS[index]!;
  }, []);

  const getAppColor = useCallback((sourceApp: string): string => {
    const index = hashString(sourceApp) % SESSION_COLORS.length;
    return SESSION_COLORS[index]!;
  }, []);

  const getHexColorForApp = useCallback((sourceApp: string): string => {
    const cached = appColorCache.current.get(sourceApp);
    if (cached) return cached;

    const index = hashString(sourceApp) % APP_HUES.length;
    const hue = APP_HUES[index]!;
    const color = `hsl(${hue}, 70%, 55%)`;
    appColorCache.current.set(sourceApp, color);
    return color;
  }, []);

  return { getSessionColor, getAppColor, getHexColorForApp };
}
