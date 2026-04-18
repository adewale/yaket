import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { spawnSync } from "node:child_process";

import { extractKeywordDetails, loadStopwords, splitSentences, tokenizeWords } from "../src/index.js";

const KOMOROSKE_ARCHIVE_ID = "1xRiCqpy3LMAgEsHdX-IA23j6nUISdT5nAJmtKbk9wNA";
const KOMOROSKE_ARCHIVE_URL = `https://raw.githubusercontent.com/adewale/bobbin/main/data/raw/${KOMOROSKE_ARCHIVE_ID}.html`;
const DEFAULT_TOP = 10;
const DEFAULT_NGRAM = 3;

async function main(): Promise<void> {
  const html = await fetchText(KOMOROSKE_ARCHIVE_URL);
  const archiveText = htmlToText(html);
  const episodes = splitArchiveEpisodes(archiveText);

  if (episodes.length === 0) {
    throw new Error("No Komoroske episodes found in archive text");
  }

  const targetEpisode = episodes[0]!;
  const stopwords = loadStopwords("en");

  const yaket = benchmark("Yaket", () => extractKeywordDetails(targetEpisode.text, {
    lan: "en",
    n: DEFAULT_NGRAM,
    top: DEFAULT_TOP,
  }).map(({ normalizedKeyword, score }) => ({ keyword: normalizedKeyword, score })));

  const bobbin = benchmark("Bobbin", () => extractBobbinBaselineKeywords(targetEpisode.text, DEFAULT_TOP, DEFAULT_NGRAM));
  const tfidf = benchmark("TF-IDF", () => extractTfidfKeywords(targetEpisode.text, episodes.map((episode) => episode.text), stopwords, DEFAULT_TOP, DEFAULT_NGRAM));
  const python = benchmark("Python YAKE", () => extractPythonYake(targetEpisode.text, DEFAULT_TOP, DEFAULT_NGRAM));

  const report = renderReport({
    targetEpisode,
    episodeCount: episodes.length,
    archiveId: KOMOROSKE_ARCHIVE_ID,
    archiveUrl: KOMOROSKE_ARCHIVE_URL,
    yaket,
    bobbin,
    tfidf,
    python,
  });

  const outputPath = resolve(process.cwd(), "docs/benchmarks/komoroske-2026-04-06.md");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, report);
  process.stdout.write(`${report}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});

type RankedKeyword = { keyword: string; score: number };
type BenchmarkResult = {
  label: string;
  durationMs: number;
  heapDeltaBytes: number;
  keywords: RankedKeyword[];
  error?: string;
};

type Episode = {
  rawDate: string;
  isoDate: string;
  text: string;
};

function benchmark(label: string, run: () => RankedKeyword[]): BenchmarkResult {
  const start = performance.now();
  const heapStart = process.memoryUsage().heapUsed;

  try {
    const keywords = run();
    return {
      label,
      durationMs: performance.now() - start,
      heapDeltaBytes: Math.max(process.memoryUsage().heapUsed - heapStart, 0),
      keywords,
    };
  } catch (error) {
    return {
      label,
      durationMs: performance.now() - start,
      heapDeltaBytes: Math.max(process.memoryUsage().heapUsed - heapStart, 0),
      keywords: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitArchiveEpisodes(text: string): Episode[] {
  const datePattern = /\b(\d{1,2}\/\d{1,2}\/\d{2})\b/g;
  const matches = [...text.matchAll(datePattern)];
  const episodes: Episode[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]!;
    const nextMatch = matches[index + 1];
    const start = (match.index ?? 0) + match[0].length;
    const end = nextMatch?.index ?? text.length;
    const episodeText = text.slice(start, end).trim();

    if (episodeText.length < 800) {
      continue;
    }

    episodes.push({
      rawDate: match[1]!,
      isoDate: toIsoDate(match[1]!),
      text: episodeText,
    });
  }

  return episodes;
}

function toIsoDate(rawDate: string): string {
  const [month, day, year] = rawDate.split("/").map((part) => Number(part));
  return `20${String(year).padStart(2, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractTfidfKeywords(text: string, corpus: string[], stopwords: Set<string>, top: number, maxNgram: number): RankedKeyword[] {
  const corpusCounts = corpus.map((document) => countCandidates(document, stopwords, maxNgram));
  const targetCounts = countCandidates(text, stopwords, maxNgram);
  const totalDocuments = corpusCounts.length;

  const scored = [...targetCounts.entries()].map(([keyword, tf]) => {
    const df = corpusCounts.reduce((count, counts) => count + (counts.has(keyword) ? 1 : 0), 0);
    const idf = Math.log((1 + totalDocuments) / (1 + df)) + 1;
    return {
      keyword,
      score: tf * idf,
    };
  });

  return scored
    .sort((left, right) => right.score - left.score || left.keyword.localeCompare(right.keyword))
    .slice(0, top);
}

function countCandidates(text: string, stopwords: Set<string>, maxNgram: number): Map<string, number> {
  const counts = new Map<string, number>();

  for (const sentence of splitSentences(text)) {
    const words = tokenizeWords(sentence)
      .map((word) => word.toLowerCase())
      .filter((word) => word.length > 0 && !((word.startsWith("'") || word.startsWith("’")) && word.length > 1));

    for (let size = 1; size <= maxNgram; size += 1) {
      for (let index = 0; index <= words.length - size; index += 1) {
        const candidateWords = words.slice(index, index + size);
        if (candidateWords.length === 0) {
          continue;
        }

        if (stopwords.has(candidateWords[0]!) || stopwords.has(candidateWords[candidateWords.length - 1]!)) {
          continue;
        }

        if (size === 1 && candidateWords[0]!.length < 3) {
          continue;
        }

        const candidate = candidateWords.join(" ");
        counts.set(candidate, (counts.get(candidate) ?? 0) + 1);
      }
    }
  }

  return counts;
}

function extractPythonYake(text: string, top: number, maxNgram: number): RankedKeyword[] {
  const script = [
    "import json, os, sys",
    "sys.path.insert(0, os.environ.get('YAKET_PYTHONPATH', '/tmp/yake'))",
    "import yake",
    "text = os.environ['YAKET_BENCHMARK_TEXT']",
    "keywords = yake.KeywordExtractor(lan='en', n=int(os.environ['YAKET_NGRAM']), top=int(os.environ['YAKET_TOP'])).extract_keywords(text)",
    "print(json.dumps(keywords, ensure_ascii=False))",
  ].join("\n");

  const result = spawnSync("python3", ["-c", script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      YAKET_BENCHMARK_TEXT: text,
      YAKET_TOP: String(top),
      YAKET_NGRAM: String(maxNgram),
    },
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || "Python YAKE benchmark failed");
  }

  return (JSON.parse(result.stdout) as Array<[string, number]>).map(([keyword, score]) => ({
    keyword: keyword.toLowerCase(),
    score,
  }));
}

function renderReport(input: {
  targetEpisode: Episode;
  episodeCount: number;
  archiveId: string;
  archiveUrl: string;
  yaket: BenchmarkResult;
  bobbin: BenchmarkResult;
  tfidf: BenchmarkResult;
  python: BenchmarkResult;
}): string {
  return [
    "# Komoroske Benchmark",
    "",
    `- Source archive ID: \`${input.archiveId}\``,
    `- Source archive URL: ${input.archiveUrl}`,
    `- Episode date: \`${input.targetEpisode.isoDate}\` (from raw heading \`${input.targetEpisode.rawDate}\`)`,
    `- Corpus episodes used for TF-IDF: ${input.episodeCount}`,
    `- Target episode length: ${input.targetEpisode.text.length} characters`,
    "",
    "## Runtime",
    "",
    "| System | Duration (ms) | Heap Delta (KB) | Notes |",
    "|---|---:|---:|---|",
    runtimeRow(input.yaket),
    runtimeRow(input.bobbin),
    runtimeRow(input.tfidf),
    runtimeRow(input.python),
    "",
    "## Top Keywords",
    "",
    "### Yaket",
    "",
    renderKeywords(input.yaket.keywords),
    "",
    "### Bobbin Baseline",
    "",
    renderKeywords(input.bobbin.keywords),
    "",
    "### TF-IDF Baseline",
    "",
    renderKeywords(input.tfidf.keywords),
    "",
    "### Python YAKE",
    "",
    renderKeywords(input.python.keywords),
    "",
    "## Overlap",
    "",
    "| Comparison | Top-10 Overlap with Python | Shared Keywords |",
    "|---|---:|---|",
    overlapRow("Yaket", input.yaket.keywords, input.python.keywords),
    overlapRow("Bobbin baseline", input.bobbin.keywords, input.python.keywords),
    overlapRow("TF-IDF", input.tfidf.keywords, input.python.keywords),
    "",
    "## Notes",
    "",
    "- Yaket should be judged primarily by closeness to Python YAKE plus downstream Bobbin topic quality.",
    "- The TF-IDF baseline uses the same stopword list and up-to-3-gram candidate generation for a cleaner comparison.",
    "- The Bobbin baseline is derived from the original `src/services/yake.ts` implementation.",
  ].join("\n");
}

function runtimeRow(result: BenchmarkResult): string {
  return `| ${result.label} | ${result.durationMs.toFixed(2)} | ${(result.heapDeltaBytes / 1024).toFixed(2)} | ${result.error ?? "ok"} |`;
}

function renderKeywords(keywords: RankedKeyword[]): string {
  if (keywords.length === 0) {
    return "_No keywords produced._";
  }

  return [
    "| Rank | Keyword | Score |",
    "|---:|---|---:|",
    ...keywords.map((item, index) => `| ${index + 1} | ${escapePipe(item.keyword)} | ${item.score.toFixed(6)} |`),
  ].join("\n");
}

function overlapRow(label: string, left: RankedKeyword[], right: RankedKeyword[]): string {
  const leftSet = new Set(left.map((item) => item.keyword));
  const rightSet = new Set(right.map((item) => item.keyword));
  const shared = [...leftSet].filter((keyword) => rightSet.has(keyword)).sort();
  return `| ${label} | ${shared.length} | ${shared.map(escapePipe).join(", ")} |`;
}

function escapePipe(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function extractBobbinBaselineKeywords(text: string, n = 5, maxNgram = 3): RankedKeyword[] {
  if (!text || text.trim().length === 0) return [];

  const STOPWORDS = new Set([
    "a", "about", "above", "after", "again", "against", "all", "am", "an",
    "and", "any", "are", "aren't", "as", "at", "be", "because", "been",
    "before", "being", "below", "between", "both", "but", "by", "can",
    "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does",
    "doesn't", "doing", "don't", "down", "during", "each", "few", "for",
    "from", "further", "get", "got", "had", "hadn't", "has", "hasn't",
    "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her",
    "here", "hers", "herself", "him", "himself", "his", "how", "i", "i'd",
    "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it",
    "it's", "its", "itself", "just", "let's", "me", "might", "more",
    "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off",
    "on", "once", "only", "or", "other", "ought", "our", "ours",
    "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd",
    "she'll", "she's", "should", "shouldn't", "so", "some", "such",
    "than", "that", "that's", "the", "their", "theirs", "them",
    "themselves", "then", "there", "there's", "these", "they", "they'd",
    "they'll", "they're", "they've", "this", "those", "through", "to",
    "too", "under", "until", "up", "us", "very", "was", "wasn't", "we",
    "we'd", "we'll", "we're", "we've", "were", "weren't", "what",
    "what's", "when", "when's", "where", "where's", "which", "while",
    "who", "who's", "whom", "why", "why's", "will", "with", "won't",
    "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've",
    "your", "yours", "yourself", "yourselves", "also", "still", "even",
    "many", "much", "well", "however", "already", "often", "really",
    "quite", "rather",
  ]);

  const sentences = text.split(/[.!?]+/).filter((sentence) => sentence.trim().length > 0);
  if (sentences.length === 0) return [];

  const allWords: Array<{ word: string; original: string; sentIdx: number; posIdx: number }> = [];
  let globalPos = 0;
  for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex += 1) {
    const words = sentences[sentenceIndex]!.trim().split(/\s+/).filter((word) => word.length > 0);
    for (const word of words) {
      const clean = word.replace(/[^a-zA-Z0-9'-]/g, "");
      if (clean.length > 0) {
        allWords.push({ word: clean.toLowerCase(), original: clean, sentIdx: sentenceIndex, posIdx: globalPos });
        globalPos += 1;
      }
    }
  }

  if (allWords.length === 0) return [];

  const wordFeatures = new Map<string, { tf: number; casing: number; position: number; relatedness: number; sentences: number }>();
  const contextLeft = new Map<string, Set<string>>();
  const contextRight = new Map<string, Set<string>>();

  for (let index = 0; index < allWords.length; index += 1) {
    const currentWord = allWords[index]!.word;
    if (STOPWORDS.has(currentWord) || currentWord.length < 2) continue;

    const feature = wordFeatures.get(currentWord) ?? { tf: 0, casing: 0, position: 0, relatedness: 0, sentences: 0 };
    feature.tf += 1;

    if (allWords[index]!.original[0] === allWords[index]!.original[0]!.toUpperCase() && allWords[index]!.original[0] !== allWords[index]!.original[0]!.toLowerCase()) {
      feature.casing += 1;
    }

    wordFeatures.set(currentWord, feature);

    if (!contextLeft.has(currentWord)) contextLeft.set(currentWord, new Set());
    if (!contextRight.has(currentWord)) contextRight.set(currentWord, new Set());
    if (index > 0 && !STOPWORDS.has(allWords[index - 1]!.word)) {
      contextLeft.get(currentWord)!.add(allWords[index - 1]!.word);
    }
    if (index < allWords.length - 1 && !STOPWORDS.has(allWords[index + 1]!.word)) {
      contextRight.get(currentWord)!.add(allWords[index + 1]!.word);
    }
  }

  const totalWords = allWords.length;
  for (const [word, feature] of wordFeatures) {
    const positions = allWords.filter((item) => item.word === word).map((item) => item.posIdx / totalWords).sort((left, right) => left - right);
    feature.position = positions[Math.floor(positions.length / 2)]!;
    feature.sentences = new Set(allWords.filter((item) => item.word === word).map((item) => item.sentIdx)).size;
    feature.casing /= feature.tf;
    feature.relatedness = ((contextLeft.get(word)?.size ?? 0) + (contextRight.get(word)?.size ?? 0)) / (feature.tf || 1);
  }

  const meanTf = [...wordFeatures.values()].reduce((sum, feature) => sum + feature.tf, 0) / wordFeatures.size;
  const stdTf = Math.sqrt([...wordFeatures.values()].reduce((sum, feature) => sum + ((feature.tf - meanTf) ** 2), 0) / wordFeatures.size);
  const wordScores = new Map<string, number>();

  for (const [word, feature] of wordFeatures) {
    const tCase = Math.max(feature.casing, 1 - feature.casing);
    const tPos = Math.log(2 + feature.position);
    const tFreq = feature.tf / (meanTf + stdTf + 1);
    const tRel = 1 + feature.relatedness;
    const tSent = feature.sentences / sentences.length;
    wordScores.set(word, (tPos * tRel) / (tCase + (tFreq / tRel) + (0.5 * tSent) + 1));
  }

  const candidates = new Map<string, number>();
  for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex += 1) {
    const sentWords = allWords.filter((item) => item.sentIdx === sentenceIndex);

    for (let size = 1; size <= maxNgram; size += 1) {
      for (let index = 0; index <= sentWords.length - size; index += 1) {
        const gram = sentWords.slice(index, index + size);
        const words = gram.map((item) => item.word);

        if (STOPWORDS.has(words[0]!) || STOPWORDS.has(words[words.length - 1]!)) continue;
        if (words.every((word) => STOPWORDS.has(word))) continue;
        if (size === 1 && words[0]!.length < 3) continue;

        let score = 1;
        let allScored = true;
        for (const word of words) {
          const wordScore = wordScores.get(word);
          if (wordScore == null) {
            allScored = false;
            break;
          }
          score *= wordScore;
        }

        if (!allScored) continue;

        score /= (size * 0.5) + 0.5;
        const phrase = words.join(" ");
        if (!candidates.has(phrase) || candidates.get(phrase)! > score) {
          candidates.set(phrase, score);
        }
      }
    }
  }

  const sorted = [...candidates.entries()].sort((left, right) => left[1] - right[1]);
  const results: RankedKeyword[] = [];
  const seen = new Set<string>();

  for (const [keyword, score] of sorted) {
    if (results.length >= n) break;
    if ([...seen].some((selected) => selected.includes(keyword) || keyword.includes(selected))) {
      continue;
    }

    seen.add(keyword);
    results.push({ keyword, score });
  }

  return results;
}
