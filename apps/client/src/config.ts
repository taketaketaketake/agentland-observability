export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000/stream';
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
export const MAX_EVENTS = parseInt(import.meta.env.VITE_MAX_EVENTS_TO_DISPLAY || '300');
