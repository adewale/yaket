import { DEFAULT_YAKE_OPTIONS } from "./defaults.js";
import type { KeywordExtractorOptions } from "./KeywordExtractor.js";

export type PositiveInt = number & { readonly __brand: "PositiveInt" };
export type Similarity01 = number & { readonly __brand: "Similarity01" };
export type DedupFunctionName = "seqm" | "levs" | "jaro";

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export interface OptionError {
  readonly message: string;
}

export interface YakeConfig {
  readonly language: string;
  readonly n: number;
  readonly dedupLim: number;
  readonly dedupFunc: DedupFunctionName;
  readonly windowSize: number;
  readonly top: number;
  readonly features: string[] | null;
}

const VALID_DEDUP_FUNC_NAMES = new Set<DedupFunctionName>(["seqm", "levs", "jaro"]);

/**
 * Snake_case keys removed in 0.6. Reject these at runtime so callers that
 * construct options from a plain JS object or JSON payload (where the
 * TypeScript guard does not apply) get a loud error instead of silent
 * fallback to defaults.
 */
const REMOVED_OPTION_KEYS: ReadonlyArray<[string, string]> = [
  ["lan", "language"],
  ["dedup_lim", "dedupLim"],
  ["dedup_func", "dedupFunc"],
  ["windowsSize", "windowSize"],
  ["window_size", "windowSize"],
];

/**
 * Parses public options into the canonical internal config. This is the only
 * place where public defaults and removed option aliases are interpreted.
 */
export function parseYakeOptions(options: KeywordExtractorOptions = {}): Result<YakeConfig, OptionError> {
  for (const [legacy, canonical] of REMOVED_OPTION_KEYS) {
    // Use `in` so inherited legacy keys (e.g. on the prototype of a class
    // that mirrors Python YAKE's option shape) are also caught — not just
    // own enumerable properties on plain JS objects.
    if (legacy in options) {
      return {
        ok: false,
        error: {
          message: `Yaket option "${legacy}" was removed in 0.6; use "${canonical}" instead. See docs/migration-bobbin-0.6.md.`,
        },
      };
    }
  }

  const dedupFunc = (options.dedupFunc ?? DEFAULT_YAKE_OPTIONS.dedupFunc).toLowerCase();
  if (!isDedupFunctionName(dedupFunc)) {
    return {
      ok: false,
      error: {
        message: `Unknown dedupFunc "${options.dedupFunc}"; expected one of "seqm", "levs", "jaro".`,
      },
    };
  }

  const n = options.n ?? DEFAULT_YAKE_OPTIONS.n;
  const top = options.top ?? DEFAULT_YAKE_OPTIONS.top;
  const windowSize = options.windowSize ?? DEFAULT_YAKE_OPTIONS.windowSize;
  const dedupLim = options.dedupLim ?? DEFAULT_YAKE_OPTIONS.dedupLim;

  const positiveIntegerError = firstPositiveIntegerError({ n, top, windowSize });
  if (positiveIntegerError != null) {
    return { ok: false, error: { message: positiveIntegerError } };
  }

  if (!Number.isFinite(dedupLim) || dedupLim < 0) {
    return { ok: false, error: { message: `dedupLim must be a finite non-negative number, got ${String(dedupLim)}.` } };
  }

  return {
    ok: true,
    value: {
      language: options.language ?? DEFAULT_YAKE_OPTIONS.language,
      n,
      dedupLim,
      dedupFunc,
      windowSize,
      top,
      features: options.features ?? DEFAULT_YAKE_OPTIONS.features,
    },
  };
}

function isDedupFunctionName(value: string): value is DedupFunctionName {
  return VALID_DEDUP_FUNC_NAMES.has(value as DedupFunctionName);
}

function firstPositiveIntegerError(values: Readonly<Record<"n" | "top" | "windowSize", number>>): string | null {
  for (const [key, value] of Object.entries(values)) {
    if (!Number.isInteger(value) || value < 1) {
      return `${key} must be a positive integer, got ${String(value)}.`;
    }
  }

  return null;
}
