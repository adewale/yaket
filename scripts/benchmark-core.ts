import { performance } from "node:perf_hooks";

import { extractKeywordDetails } from "../src/index.js";

const ITERATIONS = 200;
const SAMPLE_TEXTS = [
  "Cloudflare Workers run JavaScript close to users. Modern edge runtimes shrink latency and simplify deployment for globally distributed applications.",
  "Google is acquiring data science community Kaggle. Sources tell us that Google is acquiring Kaggle, a platform that hosts data science and machine learning competitions.",
  "The indexing service creates hybrid retrieval metadata for each chunk. It stores BM25 text fields, dense embeddings, chunk-level filters, and weighted keywords. Incremental reindexing reuses previous vectors, but always refreshes keyword metadata so search results stay explainable and debuggable.",
  "Consumer AI is being absorbed by platforms. Enterprise AI converges around a few vendors. Vertical AI is the third path, carving out domain-specific value while APIs become commodities.",
];

function main(): void {
  const durations: number[] = [];
  const heapStart = process.memoryUsage().heapUsed;
  let keywordCount = 0;

  // Warm up V8 and module-level caches before measuring.
  for (const text of SAMPLE_TEXTS) {
    keywordCount += extractKeywordDetails(text, { language: "en", n: 3, top: 10 }).length;
  }

  for (let index = 0; index < ITERATIONS; index += 1) {
    const text = SAMPLE_TEXTS[index % SAMPLE_TEXTS.length]!;
    const start = performance.now();
    keywordCount += extractKeywordDetails(text, { language: "en", n: 3, top: 10 }).length;
    durations.push(performance.now() - start);
  }

  const heapDeltaKb = Math.max(process.memoryUsage().heapUsed - heapStart, 0) / 1024;
  durations.sort((left, right) => left - right);

  const totalMs = durations.reduce((sum, value) => sum + value, 0);
  const averageMs = totalMs / durations.length;
  const p50Ms = percentile(durations, 0.50);
  const p95Ms = percentile(durations, 0.95);
  const docsPerSecond = ITERATIONS / (totalMs / 1000);

  process.stdout.write([
    "# Core Benchmark",
    "",
    "Local checked-in fixture benchmark. No network or Python YAKE dependency.",
    "",
    `- Iterations: ${ITERATIONS}`,
    `- Sample documents: ${SAMPLE_TEXTS.length}`,
    `- Total duration (ms): ${totalMs.toFixed(2)}`,
    `- Average duration (ms): ${averageMs.toFixed(3)}`,
    `- p50 duration (ms): ${p50Ms.toFixed(3)}`,
    `- p95 duration (ms): ${p95Ms.toFixed(3)}`,
    `- Documents/sec: ${docsPerSecond.toFixed(2)}`,
    `- Heap delta (KB): ${heapDeltaKb.toFixed(2)}`,
    `- Keywords produced, including warmup: ${keywordCount}`,
    "",
  ].join("\n"));
}

function percentile(sorted: readonly number[], quantile: number): number {
  if (sorted.length === 0) {
    return 0;
  }

  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * quantile));
  return sorted[index]!;
}

main();
