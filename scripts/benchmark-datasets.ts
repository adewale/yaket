import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { spawnSync } from "node:child_process";

import { extractKeywordDetails } from "../src/index.js";

type DatasetName = "inspec" | "semeval2010";
type ParsedArgs = { datasets: DatasetName[]; limit: number };

type Example = {
  id: string;
  text: string;
  gold: string[];
};

type RankedKeyword = { keyword: string; score: number };

const { datasets, limit } = parseArgs(process.argv.slice(2));
const reportParts: string[] = [
  "# Dataset Benchmarks",
  "",
  "These benchmark scripts compare Yaket to upstream Python YAKE on standard keyphrase datasets.",
  "",
  "Prerequisite:",
  "",
  "```bash",
  "python -m pip install numpy networkx segtok jellyfish",
  "```",
  "",
];

for (const dataset of datasets) {
  const examples = await loadDatasetExamples(dataset, limit);
  const results = examples.map((example) => benchmarkExample(example));

  const avgTop10Overlap = average(results.map((result) => overlapCount(result.yaket, result.python, 10)));
  const avgPrecisionAt10 = average(results.map((result) => precisionAtK(result.yaket, result.example.gold, 10)));
  const avgPythonPrecisionAt10 = average(results.map((result) => precisionAtK(result.python, result.example.gold, 10)));
  const yaketDuration = average(results.map((result) => result.yaketMs));
  const pythonDuration = average(results.map((result) => result.pythonMs));

  reportParts.push(
    `## ${dataset}`,
    "",
    `- examples evaluated: ${results.length}`,
    `- average top-10 overlap with Python YAKE: ${avgTop10Overlap.toFixed(2)}`,
    `- Yaket precision@10 against gold keyphrases: ${avgPrecisionAt10.toFixed(3)}`,
    `- Python YAKE precision@10 against gold keyphrases: ${avgPythonPrecisionAt10.toFixed(3)}`,
    `- average Yaket runtime per document (ms): ${yaketDuration.toFixed(2)}`,
    `- average Python YAKE runtime per document (ms): ${pythonDuration.toFixed(2)}`,
    "",
    "### Sample document",
    "",
    `- id: ${results[0]!.example.id}`,
    `- Yaket top-5: ${results[0]!.yaket.slice(0, 5).map((item) => item.keyword).join(", ")}`,
    `- Python top-5: ${results[0]!.python.slice(0, 5).map((item) => item.keyword).join(", ")}`,
    `- Gold keyphrases: ${results[0]!.example.gold.slice(0, 10).join(", ")}`,
    "",
  );
}

const outputPath = resolve(process.cwd(), "docs/benchmarks/inspec-semeval.md");
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, reportParts.join("\n"));
process.stdout.write(`${reportParts.join("\n")}\n`);

function parseArgs(argv: string[]): ParsedArgs {
  const requested = argv.filter((item): item is DatasetName => item === "inspec" || item === "semeval2010");
  const limitFlagIndex = argv.findIndex((item) => item === "--limit");
  const limit = limitFlagIndex >= 0 ? Number(argv[limitFlagIndex + 1] ?? 50) : 50;

  return {
    datasets: requested.length > 0 ? requested : ["inspec", "semeval2010"],
    limit: Number.isFinite(limit) && limit > 0 ? limit : 50,
  };
}

async function loadDatasetExamples(dataset: DatasetName, limit: number): Promise<Example[]> {
  const url = `https://datasets-server.huggingface.co/rows?dataset=midas%2F${dataset}&config=extraction&split=test&offset=0&length=${limit}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load ${dataset} dataset: ${response.status}`);
  }

  const payload = await response.json() as {
    rows: Array<{
      row: {
        id?: string;
        document?: string[];
        doc_bio_tags?: string[];
      };
    }>;
  };

  return payload.rows.slice(0, limit).map(({ row }, index) => {
    const tokens = row.document ?? [];
    const tags = row.doc_bio_tags ?? [];

    return {
      id: row.id ?? String(index),
      text: tokens.join(" "),
      gold: extractBioKeyphrases(tokens, tags),
    };
  });
}

function benchmarkExample(example: Example): { example: Example; yaket: RankedKeyword[]; python: RankedKeyword[]; yaketMs: number; pythonMs: number } {
  const yaketStart = performance.now();
  const yaket = extractKeywordDetails(example.text, { lan: "en", n: 3, top: 10 })
    .map(({ normalizedKeyword, score }) => ({ keyword: normalizedKeyword, score }));
  const yaketMs = performance.now() - yaketStart;

  const pythonStart = performance.now();
  const python = extractPythonYake(example.text, 10, 3);
  const pythonMs = performance.now() - pythonStart;

  return { example, yaket, python, yaketMs, pythonMs };
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

function overlapCount(left: RankedKeyword[], right: RankedKeyword[], top: number): number {
  const a = new Set(left.slice(0, top).map((item) => item.keyword));
  const b = new Set(right.slice(0, top).map((item) => item.keyword));
  return [...a].filter((item) => b.has(item)).length;
}

function precisionAtK(predicted: RankedKeyword[], gold: string[], top: number): number {
  if (top === 0) {
    return 0;
  }

  const goldSet = new Set(gold.map((item) => item.toLowerCase()));
  const predictedTop = predicted.slice(0, top).map((item) => item.keyword.toLowerCase());
  const hits = predictedTop.filter((item) => goldSet.has(item)).length;
  return hits / top;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function extractBioKeyphrases(tokens: string[], tags: string[]): string[] {
  const phrases: string[] = [];
  let current: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    const tag = tags[index] ?? "O";

    if (tag === "B" || tag === "B-KP") {
      if (current.length > 0) {
        phrases.push(current.join(" ").toLowerCase());
      }
      current = [token];
      continue;
    }

    if ((tag === "I" || tag === "I-KP") && current.length > 0) {
      current.push(token);
      continue;
    }

    if (current.length > 0) {
      phrases.push(current.join(" ").toLowerCase());
      current = [];
    }
  }

  if (current.length > 0) {
    phrases.push(current.join(" ").toLowerCase());
  }

  return [...new Set(phrases)];
}
