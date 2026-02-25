import { useState, useEffect, useCallback, useRef } from 'react';
import type { SessionAnalysis } from '../types';
import { API_URL } from '../config';

export function useSessionAnalysis(sessionId: string) {
  const [analysis, setAnalysis] = useState<SessionAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAnalysis = useCallback(() => {
    return fetch(`${API_URL}/session-analysis/${encodeURIComponent(sessionId)}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: any) => {
        if (data.status === 'not_found') {
          setAnalysis(null);
        } else {
          setAnalysis(data as SessionAnalysis);
          // Stop polling if terminal state
          if (data.status === 'completed' || data.status === 'failed') {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        }
        setError(null);
      })
      .catch(err => setError(err.message));
  }, [sessionId]);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchAnalysis().finally(() => setLoading(false));
  }, [fetchAnalysis]);

  useEffect(() => {
    setLoading(true);
    fetchAnalysis().finally(() => setLoading(false));
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [fetchAnalysis]);

  const reanalyze = useCallback(() => {
    setLoading(true);
    fetch(`${API_URL}/session-analysis/${encodeURIComponent(sessionId)}/reanalyze`, { method: 'POST' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        // Start polling for result
        pollRef.current = setInterval(() => {
          fetchAnalysis();
        }, 2000);
        // Also fetch immediately
        return fetchAnalysis();
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [sessionId, fetchAnalysis]);

  return { analysis, loading, error, reanalyze, refetch };
}
