import { performance } from "node:perf_hooks";

import { DataCore, extractKeywordDetails, loadStopwords } from "../src/index.js";

const ITERATIONS = 200;
const SAMPLE_TEXTS = [
  "Cloudflare Workers run JavaScript close to users. Modern edge runtimes shrink latency and simplify deployment for globally distributed applications.",
  "Google is acquiring data science community Kaggle. Sources tell us that Google is acquiring Kaggle, a platform that hosts data science and machine learning competitions.",
  "The indexing service creates hybrid retrieval metadata for each chunk. It stores BM25 text fields, dense embeddings, chunk-level filters, and weighted keywords. Incremental reindexing reuses previous vectors, but always refreshes keyword metadata so search results stay explainable and debuggable.",
  "Consumer AI is being absorbed by platforms. Enterprise AI converges around a few vendors. Vertical AI is the third path, carving out domain-specific value while APIs become commodities.",
];

function main(): void {
  const extractionDurations: number[] = [];
  const dataCoreDurations: number[] = [];
  const singleFeatureDurations: number[] = [];
  const multiFeatureDurations: number[] = [];
  const stopwords = loadStopwords("en");
  const heapStart = process.memoryUsage().heapUsed;
  let keywordCount = 0;
  let candidateCount = 0;

  // Warm up V8 and module-level caches before measuring.
  for (const text of SAMPLE_TEXTS) {
    keywordCount += extractKeywordDetails(text, { language: "en", n: 3, top: 10 }).length;
  }

  for (let index = 0; index < ITERATIONS; index += 1) {
    const text = SAMPLE_TEXTS[index % SAMPLE_TEXTS.length]!;

    const extractionStart = performance.now();
    keywordCount += extractKeywordDetails(text, { language: "en", n: 3, top: 10 }).length;
    extractionDurations.push(performance.now() - extractionStart);

    const dataCoreStart = performance.now();
    const core = new DataCore(text, stopwords, { language: "en", n: 3, windowSize: 1 });
    dataCoreDurations.push(performance.now() - dataCoreStart);
    candidateCount += core.candidates.size;

    const singleStart = performance.now();
    core.buildSingleTermsFeatures(null);
    singleFeatureDurations.push(performance.now() - singleStart);

    const multiStart = performance.now();
    core.buildMultTermsFeatures(null);
    multiFeatureDurations.push(performance.now() - multiStart);
  }

  const heapDeltaKb = Math.max(process.memoryUsage().heapUsed - heapStart, 0) / 1024;
  const extraction = summarize(extractionDurations);
  const dataCore = summarize(dataCoreDurations);
  const singleFeatures = summarize(singleFeatureDurations);
  const multiFeatures = summarize(multiFeatureDurations);
  const docsPerSecond = ITERATIONS / (extraction.totalMs / 1000);

  process.stdout.write([
    "# Core Benchmark",
    "",
    "Local checked-in fixture benchmark. No network or Python YAKE dependency.",
    "",
    `- Iterations: ${ITERATIONS}`,
    `- Sample documents: ${SAMPLE_TEXTS.length}`,
    `- Documents/sec: ${docsPerSecond.toFixed(2)}`,
    `- Heap delta (KB): ${heapDeltaKb.toFixed(2)}`,
    `- Keywords produced, including warmup: ${keywordCount}`,
    `- DataCore candidates observed: ${candidateCount}`,
    "",
    "## End-to-end extraction",
    renderSummary(extraction),
    "",
    "## Phase timings",
    "",
    "| Phase | Total ms | Avg ms | p50 ms | p95 ms |",
    "|---|---:|---:|---:|---:|",
    phaseRow("DataCore build", dataCore),
    phaseRow("Single-term features", singleFeatures),
    phaseRow("Multi-term features", multiFeatures),
    "",
  ].join("\n"));
}

interface TimingSummary {
  readonly totalMs: number;
  readonly averageMs: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
}

function summarize(values: number[]): TimingSummary {
  const sorted = [...values].sort((left, right) => left - right);
  const totalMs = sorted.reduce((sum, value) => sum + value, 0);
  return {
    totalMs,
    averageMs: totalMs / sorted.length,
    p50Ms: percentile(sorted, 0.50),
    p95Ms: percentile(sorted, 0.95),
  };
}

function renderSummary(summary: TimingSummary): string {
  return [
    `- Total duration (ms): ${summary.totalMs.toFixed(2)}`,
    `- Average duration (ms): ${summary.averageMs.toFixed(3)}`,
    `- p50 duration (ms): ${summary.p50Ms.toFixed(3)}`,
    `- p95 duration (ms): ${summary.p95Ms.toFixed(3)}`,
  ].join("\n");
}

function phaseRow(label: string, summary: TimingSummary): string {
  return `| ${label} | ${summary.totalMs.toFixed(2)} | ${summary.averageMs.toFixed(3)} | ${summary.p50Ms.toFixed(3)} | ${summary.p95Ms.toFixed(3)} |`;
}

function percentile(sorted: readonly number[], quantile: number): number {
  if (sorted.length === 0) {
    return 0;
  }

  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * quantile));
  return sorted[index]!;
}

main();
