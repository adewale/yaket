const CAPITAL_LETTER_PATTERN = /^(\s*([A-Z]))/;
const TOKEN_PATTERN = /\p{L}[\p{L}\p{M}\p{Nd}]*(?:[.'’\-][\p{L}\p{M}\p{Nd}]+)*|\p{Nd}+(?:[.,]\p{Nd}+)*|[^\s]/gu;
const ASCII_PUNCTUATION = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
const COMMON_ABBREVIATIONS = new Set([
  "dr",
  "dra",
  "mr",
  "mrs",
  "ms",
  "prof",
  "sr",
  "sra",
  "jr",
  "st",
  "vs",
  "etc",
  "e.g",
  "i.e",
  "u.s",
  "u.k",
  "no",
  "nos",
]);
const SENTENCE_CLOSERS = new Set([`"`, `'`, ")", "]", "}", "»", "”", "’"]);

export const STOPWORD_WEIGHT = "bi" as const;
export const DEFAULT_EXCLUDE = new Set(ASCII_PUNCTUATION.split(""));

export function preFilter(text: string): string {
  const parts = text.split("\n");
  let buffer = "";

  for (const part of parts) {
    const separator = CAPITAL_LETTER_PATTERN.test(part) ? "\n\n" : " ";
    buffer += separator + part.replaceAll("\t", " ");
  }

  return buffer;
}

export function tokenizeSentences(text: string): string[][] {
  return splitSentences(text)
    .map((sentence) => tokenizeWords(sentence).filter((token) => !(startsWithApostrophe(token) && token.length > 1) && token.length > 0))
    .filter((sentence) => sentence.length > 0);
}

export function tokenizeWords(text: string): string[] {
  const tokens = text.match(TOKEN_PATTERN) ?? [];
  const expanded: string[] = [];

  for (const token of tokens) {
    expanded.push(...splitContractions(token));
  }

  return expanded;
}

export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  let index = 0;

  while (index < text.length) {
    if (text[index] === "\n" && text[index + 1] === "\n") {
      pushSentence(sentences, text.slice(start, index));
      start = skipWhitespace(text, index + 2);
      index = start;
      continue;
    }

    if (!isSentenceTerminal(text[index]!)) {
      index += 1;
      continue;
    }

    let end = index;
    while (end + 1 < text.length && SENTENCE_CLOSERS.has(text[end + 1]!)) {
      end += 1;
    }

    const next = skipWhitespace(text, end + 1);
    if (shouldSplitSentence(text, index, next)) {
      pushSentence(sentences, text.slice(start, end + 1));
      start = next;
      index = next;
      continue;
    }

    index = end + 1;
  }

  pushSentence(sentences, text.slice(start));
  return sentences;
}

function splitContractions(token: string): string[] {
  const normalized = token.toLowerCase();
  const apostropheIndex = Math.max(normalized.lastIndexOf("'"), normalized.lastIndexOf("’"));

  if (apostropheIndex <= 0 || apostropheIndex >= token.length - 1) {
    return [token];
  }

  const base = token.slice(0, apostropheIndex);
  const suffix = token.slice(apostropheIndex);
  const normalizedSuffix = normalized.slice(apostropheIndex);

  if (["'s", "'re", "'ve", "'ll", "'d", "'m", "’s", "’re", "’ve", "’ll", "’d", "’m"].includes(normalizedSuffix)) {
    return base.length > 0 ? [base, suffix] : [token];
  }

  if (normalized.endsWith("n't") && base.length > 0) {
    return [token.slice(0, -3), token.slice(-3)];
  }

  return [token];
}

function startsWithApostrophe(token: string): boolean {
  return token.startsWith("'") || token.startsWith("’");
}

function isSentenceTerminal(char: string): boolean {
  return char === "." || char === "!" || char === "?";
}

function shouldSplitSentence(text: string, punctuationIndex: number, nextIndex: number): boolean {
  if (nextIndex >= text.length) {
    return true;
  }

  const punctuation = text[punctuationIndex]!;
  if (punctuation !== ".") {
    return nextIndex > punctuationIndex + 1;
  }

  if (isDecimalPoint(text, punctuationIndex) || isInitialism(text, punctuationIndex)) {
    return false;
  }

  const previousWord = getPreviousWord(text, punctuationIndex).toLowerCase();
  if (COMMON_ABBREVIATIONS.has(previousWord)) {
    return false;
  }

  const nextWord = getNextWord(text, nextIndex);
  if (nextWord.length > 0 && isLower(nextWord[0]!)) {
    return false;
  }

  return nextIndex > punctuationIndex + 1;
}

function isDecimalPoint(text: string, punctuationIndex: number): boolean {
  return isDigit(text[punctuationIndex - 1] ?? "") && isDigit(text[punctuationIndex + 1] ?? "");
}

function isInitialism(text: string, punctuationIndex: number): boolean {
  const left = text.slice(0, punctuationIndex + 1);
  if (/(?:\b\p{L}\.){2,}$/u.test(left)) {
    return true;
  }

  return isLetter(text[punctuationIndex - 1] ?? "") && isLetter(text[punctuationIndex + 1] ?? "") && text[punctuationIndex + 2] === ".";
}

function getPreviousWord(text: string, punctuationIndex: number): string {
  let start = punctuationIndex - 1;
  while (start >= 0 && isWordChar(text[start]!)) {
    start -= 1;
  }

  return text.slice(start + 1, punctuationIndex);
}

function getNextWord(text: string, startIndex: number): string {
  let end = startIndex;
  while (end < text.length && isWordChar(text[end]!)) {
    end += 1;
  }

  return text.slice(startIndex, end);
}

function isWordChar(char: string): boolean {
  return /^[\p{L}\p{M}\p{Nd}]$/u.test(char);
}

function isLower(char: string): boolean {
  return char.toLowerCase() === char && char.toUpperCase() !== char;
}

function skipWhitespace(text: string, index: number): number {
  let cursor = index;
  while (cursor < text.length && /\s/u.test(text[cursor]!)) {
    cursor += 1;
  }
  return cursor;
}

function pushSentence(sentences: string[], sentence: string): void {
  const trimmed = sentence.trim();
  if (trimmed.length > 0) {
    sentences.push(trimmed);
  }
}

export function getTag(word: string, index: number, exclude: ReadonlySet<string>): string {
  const withoutCommas = word.replaceAll(",", "");
  if (isNumeric(withoutCommas) || isNumeric(withoutCommas.replace(".", ""))) {
    return "d";
  }

  let digitCount = 0;
  let alphaCount = 0;
  let excludeCount = 0;

  for (const char of word) {
    if (isDigit(char)) {
      digitCount += 1;
    }
    if (isLetter(char)) {
      alphaCount += 1;
    }
    if (exclude.has(char)) {
      excludeCount += 1;
    }
  }

  if ((digitCount > 0 && alphaCount > 0) || (digitCount === 0 && alphaCount === 0) || excludeCount > 1) {
    return "u";
  }

  if (isAllUpper(word)) {
    return "a";
  }

  if (word.length > 1 && isUpper(word[0]!) && index > 0 && countUppercase(word) === 1) {
    return "n";
  }

  return "p";
}

function isNumeric(value: string): boolean {
  return /^\d+$/.test(value);
}

function isDigit(char: string): boolean {
  return /^\p{Nd}$/u.test(char);
}

function isLetter(char: string): boolean {
  return /^\p{L}$/u.test(char);
}

function isUpper(char: string): boolean {
  return char.toUpperCase() === char && char.toLowerCase() !== char;
}

function isAllUpper(word: string): boolean {
  let sawLetter = false;

  for (const char of word) {
    if (!isLetter(char)) {
      continue;
    }

    sawLetter = true;
    if (!isUpper(char)) {
      return false;
    }
  }

  return sawLetter;
}

function countUppercase(word: string): number {
  let count = 0;

  for (const char of word) {
    if (isUpper(char)) {
      count += 1;
    }
  }

  return count;
}
