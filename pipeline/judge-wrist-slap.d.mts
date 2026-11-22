type Meta = Record<string, any>;
type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface Verdict {
  score: number;
  components: { fine_ratio: number; no_admission: number; accountability_gap: number };
  rationale: string;
}

/** Shape written to meta.json `score_provenance` by the judge. */
export interface ScoreProvenance {
  model: string;
  prompt_sha256: string;
  judged_at: string;
  components: Verdict['components'];
  rationale: string;
  inputs_sha256: string;
}

export interface JudgeTransportOptions {
  apiKey?: string;
  model?: string;
  fetchImpl?: FetchLike | ((...args: any[]) => any);
  timeoutMs?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (msg: string) => void;
}

export interface JudgeAllOptions extends JudgeTransportOptions {
  write?: boolean;
  slug?: string | null;
  force?: boolean;
  partial?: boolean;
  plan?: boolean;
  root?: string;
  now?: () => Date;
  validateMeta?: (meta: Meta) => unknown;
  recomputeRollup?: boolean;
}

export interface JudgeSummary {
  targets: string[];
  verdicts: Array<Verdict & { slug: string }>;
  failures: Array<{ slug: string; error: string }>;
  changed: string[];
  written: string[];
  rollupChanged: boolean;
}

export declare const API_BASE: string;
export declare const PROMPT_RELATIVE_PATH: string;
export declare const DEFAULT_TIMEOUT_MS: number;
export declare const DEFAULT_MAX_ATTEMPTS: number;
export declare const DEFAULT_BASE_DELAY_MS: number;
export declare const RESOLVED_STAGES: Set<string>;
export declare const RUBRIC_COMPONENTS: Readonly<
  Record<string, { min?: number; max?: number; allowed?: number[] }>
>;
export declare class JudgeError extends Error {
  retryable: boolean;
  constructor(message: string, opts?: { retryable?: boolean; cause?: unknown });
}
export declare function sha256(text: string): string;
export declare function stableStringify(value: unknown): string;
export declare function buildCaseFacts(meta: Meta): Record<string, unknown>;
export declare function inputsHash(meta: Meta): string;
export declare function buildUserMessage(meta: Meta): string;
export declare function parseUserMessage(text: string): Record<string, any>;
export declare function validateVerdict(parsed: unknown): Verdict;
export declare function judgeCase(
  meta: Meta,
  opts: JudgeTransportOptions & { systemPrompt: string }
): Promise<Verdict>;
export declare function judgeReason(meta: Meta, opts?: { force?: boolean }): string | null;
export declare function minimalMetaCheck(meta: Meta): Meta;
export declare function judgeAll(opts?: JudgeAllOptions): Promise<JudgeSummary>;
export declare function parseJudgeArgs(argv: string[]): {
  write: boolean;
  slug: string | null;
  force: boolean;
  partial: boolean;
  plan: boolean;
};
