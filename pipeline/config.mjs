/**
 * Shared pipeline configuration. The ONE default Gemini model for the wrist-slap judge and the
 * sweep orchestrator; override with the GEMINI_MODEL environment variable.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-pro';

/** Model to use for this run: GEMINI_MODEL (trimmed) when set, else DEFAULT_GEMINI_MODEL. */
export function resolveGeminiModel(env = process.env) {
  const fromEnv = typeof env.GEMINI_MODEL === 'string' ? env.GEMINI_MODEL.trim() : '';
  return fromEnv || DEFAULT_GEMINI_MODEL;
}
