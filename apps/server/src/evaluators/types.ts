import type { EvalResult, EvalRun, EvalScope, EvalRunOptions } from '../types';

export interface EvaluatorContext {
  run: EvalRun;
  scope: EvalScope;
  options: EvalRunOptions;
  onProgress: (current: number, total: number) => void;
}

export interface EvaluatorOutput {
  results: Omit<EvalResult, 'id'>[];
  summary: Record<string, any>;
  model_name?: string;
  prompt_version?: string;
}

export interface Evaluator {
  type: string;
  requiresApiKey: boolean;
  run(ctx: EvaluatorContext): Promise<EvaluatorOutput>;
}
