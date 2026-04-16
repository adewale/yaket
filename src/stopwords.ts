import { STOPWORDS_BY_LANGUAGE } from "./stopwords.generated.js";

const stopwordsByLanguage = STOPWORDS_BY_LANGUAGE as Record<string, string> & { noLang: string };

export function getStopwordText(language: string): string {
  const key = language.slice(0, 2).toLowerCase();
  return stopwordsByLanguage[key] ?? stopwordsByLanguage.noLang;
}

export function loadStopwords(language = "en"): Set<string> {
  return new Set(
    getStopwordText(language)
      .split("\n")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0),
  );
}

export const supportedLanguages = Object.keys(stopwordsByLanguage);
