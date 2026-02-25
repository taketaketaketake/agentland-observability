import { useState, useEffect, useCallback } from 'react';
import type { EvalRun, EvalResult, EvalSummary, EvalConfig, EvalProgress, EvaluatorType, EvalScope, EvalRunOptions } from '../types';
import { API_URL } from '../config';

export function useEvaluations() {
  const [config, setConfig] = useState<EvalConfig | null>(null);
  const [summaries, setSummaries] = useState<EvalSummary[]>([]);
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<EvalRun | null>(null);
  const [selectedResults, setSelectedResults] = useState<EvalResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningEvals, setRunningEvals] = useState<Map<number, EvalProgress>>(new Map());

  // Fetch config on mount
  useEffect(() => {
    fetch(`${API_URL}/evaluations/config`)
      .then(r => r.json())
      .then(setConfig)
      .catch(err => console.error('Failed to fetch eval config:', err));
  }, []);

  // Fetch summaries
  const fetchSummaries = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/evaluations/summary`);
      const data = await r.json();
      setSummaries(data);
    } catch (err) {
      console.error('Failed to fetch eval summaries:', err);
    }
  }, []);

  // Fetch runs
  const fetchRuns = useCallback(async (opts?: { evaluator_type?: string; limit?: number }) => {
    try {
      const params = new URLSearchParams();
      if (opts?.evaluator_type) params.set('evaluator_type', opts.evaluator_type);
      if (opts?.limit) params.set('limit', String(opts.limit));
      const r = await fetch(`${API_URL}/evaluations/runs?${params}`);
      const data = await r.json();
      setRuns(data);
    } catch (err) {
      console.error('Failed to fetch eval runs:', err);
    }
  }, []);

  // Fetch single run
  const fetchRun = useCallback(async (id: number) => {
    try {
      const r = await fetch(`${API_URL}/evaluations/runs/${id}`);
      const data = await r.json();
      setSelectedRun(data);
      return data as EvalRun;
    } catch (err) {
      console.error('Failed to fetch eval run:', err);
      return null;
    }
  }, []);

  // Fetch run results
  const fetchResults = useCallback(async (runId: number, opts?: { limit?: number; offset?: number }) => {
    try {
      const params = new URLSearchParams();
      if (opts?.limit) params.set('limit', String(opts.limit));
      if (opts?.offset) params.set('offset', String(opts.offset));
      const r = await fetch(`${API_URL}/evaluations/runs/${runId}/results?${params}`);
      const data = await r.json();
      setSelectedResults(data);
      return data as EvalResult[];
    } catch (err) {
      console.error('Failed to fetch eval results:', err);
      return [];
    }
  }, []);

  // Start an evaluation
  const startEvaluation = useCallback(async (evaluator_type: EvaluatorType, scope: EvalScope, options?: EvalRunOptions) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_URL}/evaluations/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluator_type, scope, options }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Failed to start evaluation');
      }
      const run: EvalRun = await r.json();
      setRunningEvals(prev => {
        const next = new Map(prev);
        next.set(run.id, { run_id: run.id, status: 'pending', progress_current: 0, progress_total: 0 });
        return next;
      });
      // Refresh runs list
      await fetchRuns();
      return run;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchRuns]);

  // Delete a run
  const deleteRun = useCallback(async (id: number) => {
    try {
      await fetch(`${API_URL}/evaluations/runs/${id}`, { method: 'DELETE' });
      await fetchRuns();
      await fetchSummaries();
    } catch (err) {
      console.error('Failed to delete eval run:', err);
    }
  }, [fetchRuns, fetchSummaries]);

  // Handle WebSocket progress updates
  const handleProgress = useCallback((progress: EvalProgress) => {
    setRunningEvals(prev => {
      const next = new Map(prev);
      if (progress.status === 'completed' || progress.status === 'failed') {
        next.delete(progress.run_id);
        // Refresh data when a run completes
        fetchRuns();
        fetchSummaries();
      } else {
        next.set(progress.run_id, progress);
      }
      return next;
    });
  }, [fetchRuns, fetchSummaries]);

  // Load initial data
  useEffect(() => {
    fetchSummaries();
    fetchRuns();
  }, [fetchSummaries, fetchRuns]);

  return {
    config,
    summaries,
    runs,
    selectedRun,
    selectedResults,
    loading,
    error,
    runningEvals,
    startEvaluation,
    fetchSummaries,
    fetchRuns,
    fetchRun,
    fetchResults,
    deleteRun,
    handleProgress,
    setSelectedRun,
  };
}
