import { STOPWORDS_BY_LANGUAGE } from "./stopwords.generated.js";
import type { StopwordProvider } from "./strategies.js";

const stopwordsByLanguage = STOPWORDS_BY_LANGUAGE as Record<string, string> & { noLang: string };

/**
 * Frozen map of bundled stopword text by two-letter language key.
 */
export const bundledStopwordTexts = Object.freeze({ ...stopwordsByLanguage }) as Readonly<Record<string, string>>;

/**
 * Readonly alias for the bundled stopword text map.
 */
export const STOPWORDS = bundledStopwordTexts;

/**
 * Returns the bundled stopword text for a language code.
 */
export function getStopwordText(language: string): string {
  const key = language.slice(0, 2).toLowerCase();
  return stopwordsByLanguage[key] ?? stopwordsByLanguage.noLang;
}

/**
 * Loads a stopword set for the requested language.
 */
export function loadStopwords(language = "en"): Set<string> {
  return new Set(
    getStopwordText(language)
      .split("\n")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0),
  );
}

/**
 * Creates a stopword set with optional additions, removals, or replacement.
 */
export function createStopwordSet(language = "en", options: {
  add?: Iterable<string>;
  remove?: Iterable<string>;
  replace?: Iterable<string>;
} = {}): Set<string> {
  const base = options.replace == null
    ? loadStopwords(language)
    : new Set([...options.replace].map((value) => value.trim().toLowerCase()).filter(Boolean));

  for (const value of options.add ?? []) {
    const normalized = value.trim().toLowerCase();
    if (normalized.length > 0) {
      base.add(normalized);
    }
  }

  for (const value of options.remove ?? []) {
    base.delete(value.trim().toLowerCase());
  }

  return base;
}

/**
 * Creates a static stopword provider from raw text or iterable stopword values.
 */
export function createStaticStopwordProvider(input: Record<string, string | Iterable<string>>): StopwordProvider {
  const normalized = Object.fromEntries(
    Object.entries(input).map(([language, value]) => [
      language.slice(0, 2).toLowerCase(),
      typeof value === "string"
        ? value
        : [...value].map((item) => item.trim().toLowerCase()).filter(Boolean).join("\n"),
    ]),
  );

  return {
    load(language: string): Set<string> {
      const key = language.slice(0, 2).toLowerCase();
      const text = normalized[key] ?? normalized.noLang ?? "";
      return new Set(text.split("\n").map((value) => value.trim().toLowerCase()).filter(Boolean));
    },
  };
}

/**
 * Two-letter language keys available in the bundled stopword pack.
 */
export const supportedLanguages = Object.keys(stopwordsByLanguage).filter((language) => language !== "noLang");
