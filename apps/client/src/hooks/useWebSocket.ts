import { useState, useEffect, useRef, useCallback } from 'react';
import type { HookEvent, WebSocketMessage } from '../types';
import { MAX_EVENTS } from '../config';

export function useWebSocket(url: string) {
  const [events, setEvents] = useState<HookEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          if (message.type === 'initial') {
            const initialEvents = Array.isArray(message.data) ? message.data : [];
            setEvents(initialEvents.slice(-MAX_EVENTS));
          } else if (message.type === 'event') {
            const newEvent = message.data as HookEvent;
            setEvents(prev => {
              const next = [...prev, newEvent];
              if (next.length > MAX_EVENTS) {
                return next.slice(next.length - MAX_EVENTS + 10);
              }
              return next;
            });
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 3000);
      };
    } catch (err) {
      console.error('Failed to connect:', err);
      setError('Failed to connect to server');
    }
  }, [url]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return { events, isConnected, error, clearEvents };
}
