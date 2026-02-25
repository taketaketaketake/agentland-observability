import { useState, useEffect } from 'react';
import type { HistoricalInsightsResponse } from '../types';
import { API_URL } from '../config';

export function useHistoricalInsights() {
  const [data, setData] = useState<HistoricalInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/insights/historical`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
