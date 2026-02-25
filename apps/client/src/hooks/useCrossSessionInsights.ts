import { useState, useEffect } from 'react';
import type { CrossSessionInsights } from '../types';
import { API_URL } from '../config';

export function useCrossSessionInsights() {
  const [data, setData] = useState<CrossSessionInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/insights/ai`)
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
