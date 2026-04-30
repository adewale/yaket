import type { YakeOptions } from "./KeywordExtractor.js";

/**
 * Canonical public defaults for the YAKE extraction surface.
 *
 * Keep default values here so direct `DataCore` usage and the higher-level
 * `KeywordExtractor` cannot drift.
 */
export const DEFAULT_YAKE_OPTIONS = {
  language: "en",
  n: 3,
  dedupLim: 0.9,
  dedupFunc: "seqm",
  windowSize: 1,
  top: 20,
  features: null,
} as const satisfies Required<Pick<YakeOptions, "language" | "n" | "dedupLim" | "dedupFunc" | "windowSize" | "top" | "features">>;
