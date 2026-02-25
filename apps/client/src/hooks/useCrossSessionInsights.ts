import { useState, useCallback, useEffect } from 'react';
import type { CrossSessionInsights, CrossSessionMeta } from '../types';
import { API_URL } from '../config';

export function useCrossSessionInsights() {
  const [data, setData] = useState<CrossSessionInsights | null>(null);
  const [meta, setMeta] = useState<CrossSessionMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback((sessionIds?: string[]) => {
    setLoading(true);
    setError(null);
    const params = sessionIds ? `?session_ids=${sessionIds.join(',')}` : '';
    fetch(`${API_URL}/insights/ai${params}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((result: CrossSessionInsights) => {
        setData(result);
        setMeta(result._meta ?? null);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Auto-fetch unfiltered on mount
  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return { data, meta, loading, error, fetchInsights };
}
