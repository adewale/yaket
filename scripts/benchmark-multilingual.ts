import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { spawnSync } from "node:child_process";

import { extractKeywords } from "../src/index.js";

interface MultilingualSample {
  readonly language: string;
  readonly displayName: string;
  readonly text: string;
}

interface LanguageResult {
  readonly language: string;
  readonly displayName: string;
  readonly yaketDurationMs: number;
  readonly yaketKeywords: string[];
  readonly pythonKeywords: string[] | null;
  readonly pythonError: string | null;
  readonly headOverlap: number;
  readonly topKOverlap: number;
}

const TOP = 10;
const NGRAM = 3;

const SAMPLES: MultilingualSample[] = [
  {
    language: "en",
    displayName: "English",
    text: "Cloudflare Workers run JavaScript at the edge, close to users. Modern edge runtimes shrink the gap between developers and the people who use their software, and they make low-latency keyword extraction practical for ingestion pipelines.",
  },
  {
    language: "de",
    displayName: "German",
    text: "Maschinelles Lernen und künstliche Intelligenz sind wichtige Technologien für die digitale Transformation. Künstliche Intelligenz verändert die Art, wie Unternehmen Entscheidungen treffen und wie Software die Arbeit von Menschen unterstützt.",
  },
  {
    language: "es",
    displayName: "Spanish",
    text: "El aprendizaje automático y la inteligencia artificial transforman la industria moderna. La inteligencia artificial permite a las empresas tomar decisiones basadas en datos y a los equipos crear productos más útiles para sus usuarios.",
  },
  {
    language: "fr",
    displayName: "French",
    text: "L'apprentissage automatique et l'intelligence artificielle transforment l'industrie moderne. L'intelligence artificielle aide les entreprises à prendre des décisions basées sur les données et à concevoir des produits plus utiles.",
  },
  {
    language: "it",
    displayName: "Italian",
    text: "L'apprendimento automatico e l'intelligenza artificiale trasformano l'industria moderna. L'intelligenza artificiale aiuta le aziende a prendere decisioni basate sui dati e a costruire prodotti più utili per le persone.",
  },
  {
    language: "pt",
    displayName: "Portuguese",
    text: `"Conta-me Histórias." Xutos inspiram projeto premiado. A plataforma "Conta-me Histórias" foi distinguida com o Prémio Arquivo.pt, atribuído a trabalhos inovadores de investigação ou aplicação de recursos preservados da Web. A plataforma foi desenvolvida por Ricardo Campos investigador do LIAAD do INESC TEC.`,
  },
  {
    language: "nl",
    displayName: "Dutch",
    text: "Machinaal leren en kunstmatige intelligentie veranderen de moderne industrie. Kunstmatige intelligentie helpt bedrijven beslissingen te nemen op basis van data en helpt teams om bruikbare producten te bouwen voor hun gebruikers.",
  },
  {
    language: "ru",
    displayName: "Russian",
    text: "Машинное обучение и искусственный интеллект меняют современную промышленность. Искусственный интеллект помогает компаниям принимать решения на основе данных и помогает командам создавать полезные продукты для пользователей.",
  },
  {
    language: "ar",
    displayName: "Arabic",
    text: "التعلم الآلي والذكاء الاصطناعي يحولان الصناعة الحديثة. الذكاء الاصطناعي يساعد الشركات على اتخاذ قرارات تعتمد على البيانات ويساعد الفرق على بناء منتجات مفيدة للمستخدمين.",
  },
];

async function main(): Promise<void> {
  const results: LanguageResult[] = SAMPLES.map(runForLanguage);
  const report = renderReport(results);

  if (process.argv.includes("--write")) {
    const missingPython = results.find((result) => result.pythonKeywords == null);
    if (missingPython != null) {
      throw new Error(`Refusing to write multilingual benchmark report because Python YAKE is unavailable for ${missingPython.language}: ${missingPython.pythonError ?? "unknown error"}`);
    }

    const outputPath = resolve(process.cwd(), "docs/benchmarks/multilingual.md");
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, report);
  }

  process.stdout.write(`${report}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});

function runForLanguage(sample: MultilingualSample): LanguageResult {
  const start = performance.now();
  const yaketKeywords = extractKeywords(sample.text, {
    language: sample.language,
    n: NGRAM,
    top: TOP,
  }).map(([keyword]) => keyword);
  const yaketDurationMs = performance.now() - start;

  const python = runPythonYake(sample);
  const pythonKeywords = python.keywords;
  const pythonError = python.error;

  const headOverlap = pythonKeywords == null
    ? 0
    : countLeadingMatches(yaketKeywords, pythonKeywords);
  const topKOverlap = pythonKeywords == null
    ? 0
    : countSetOverlap(yaketKeywords, pythonKeywords);

  return {
    language: sample.language,
    displayName: sample.displayName,
    yaketDurationMs,
    yaketKeywords,
    pythonKeywords,
    pythonError,
    headOverlap,
    topKOverlap,
  };
}

function runPythonYake(sample: MultilingualSample): { keywords: string[] | null; error: string | null } {
  const script = [
    "import json, os, sys",
    "pythonpath = os.environ.get('YAKET_PYTHONPATH')",
    "if pythonpath:",
    "    sys.path.insert(0, pythonpath)",
    "import yake",
    "text = os.environ['YAKET_BENCHMARK_TEXT']",
    "lan = os.environ['YAKET_LAN']",
    "ext = yake.KeywordExtractor(lan=lan, n=int(os.environ['YAKET_NGRAM']), top=int(os.environ['YAKET_TOP']))",
    "print(json.dumps([k for k, _ in ext.extract_keywords(text)], ensure_ascii=False))",
  ].join("\n");

  const result = spawnSync("python3", ["-c", script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      YAKET_BENCHMARK_TEXT: sample.text,
      YAKET_LAN: sample.language,
      YAKET_TOP: String(TOP),
      YAKET_NGRAM: String(NGRAM),
    },
    encoding: "utf8",
  });

  if (result.error != null) {
    return { keywords: null, error: result.error.message };
  }

  if (result.status !== 0) {
    return { keywords: null, error: (result.stderr || "python3 exited with non-zero status").trim() };
  }

  try {
    return { keywords: JSON.parse(result.stdout) as string[], error: null };
  } catch (parseError) {
    const message = parseError instanceof Error ? parseError.message : String(parseError);
    return { keywords: null, error: `failed to parse python output: ${message}` };
  }
}

function countLeadingMatches(left: readonly string[], right: readonly string[]): number {
  const limit = Math.min(left.length, right.length);
  let count = 0;
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) {
      break;
    }
    count += 1;
  }

  return count;
}

function countSetOverlap(left: readonly string[], right: readonly string[]): number {
  const rightSet = new Set(right);
  let count = 0;
  for (const value of left) {
    if (rightSet.has(value)) {
      count += 1;
    }
  }

  return count;
}

function renderReport(results: readonly LanguageResult[]): string {
  const pythonAvailable = results.some((result) => result.pythonKeywords != null);
  const lines: string[] = [];

  lines.push("# Multilingual Benchmark");
  lines.push("");
  lines.push(`- Languages compared: ${results.length}`);
  lines.push(`- \`top\`: ${TOP}, max n-gram: ${NGRAM}`);
  lines.push(`- Python YAKE available: ${pythonAvailable ? "yes" : "no"}`);
  lines.push("");

  if (pythonAvailable) {
    lines.push("## Parity Summary");
    lines.push("");
    lines.push("| Language | Yaket runtime (ms) | Head match (leading exact prefix) | Top-K overlap |");
    lines.push("|---|---:|---:|---:|");
    for (const result of results) {
      if (result.pythonKeywords == null) {
        lines.push(`| ${result.displayName} (\`${result.language}\`) | ${result.yaketDurationMs.toFixed(2)} | n/a (${result.pythonError ?? "no python"}) | n/a |`);
        continue;
      }

      lines.push(`| ${result.displayName} (\`${result.language}\`) | ${result.yaketDurationMs.toFixed(2)} | ${result.headOverlap}/${result.pythonKeywords.length} | ${result.topKOverlap}/${result.pythonKeywords.length} |`);
    }
    lines.push("");
  }

  lines.push("## Per-language results");
  lines.push("");

  for (const result of results) {
    lines.push(`### ${result.displayName} (\`${result.language}\`)`);
    lines.push("");
    lines.push(`Yaket runtime: ${result.yaketDurationMs.toFixed(2)} ms`);
    lines.push("");
    lines.push("**Yaket top keywords**");
    lines.push("");
    for (const keyword of result.yaketKeywords) {
      lines.push(`- ${keyword}`);
    }
    lines.push("");

    if (result.pythonKeywords == null) {
      lines.push(`Python YAKE comparison unavailable: ${result.pythonError ?? "python3/yake not installed"}`);
      lines.push("");
      continue;
    }

    lines.push("**Python YAKE top keywords**");
    lines.push("");
    for (const keyword of result.pythonKeywords) {
      lines.push(`- ${keyword}`);
    }
    lines.push("");
    lines.push(`Leading exact-match prefix: ${result.headOverlap}`);
    lines.push(`Top-${TOP} set overlap: ${result.topKOverlap}`);
    lines.push("");
  }

  return lines.join("\n");
}
