#!/usr/bin/env node

import { readFileSync } from "node:fs";

import { extractKeywords, type KeywordExtractorOptions, type KeywordScore } from "./KeywordExtractor.js";

export interface CliArgs {
  textInput?: string;
  inputFile?: string;
  language?: string;
  ngramSize?: number;
  dedupFunc?: string;
  dedupLim?: number;
  windowSize?: number;
  top?: number;
  verbose: boolean;
  help: boolean;
  parseErrors: string[];
}

interface CliDeps {
  readFile(path: string): string;
  extract(text: string, options: KeywordExtractorOptions): KeywordScore[];
  stdout(message: string): void;
  stderr(message: string): void;
}

const VALID_DEDUP_FUNCTIONS = new Set(["leve", "levs", "jaro", "jaro_winkler", "seqm", "sequencematcher"]);

export function parseCliArgs(argv: string[]): CliArgs {
  const result: CliArgs = {
    verbose: false,
    help: false,
    parseErrors: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const next = argv[index + 1];

    switch (arg) {
      case "-ti":
      case "--text-input":
        if (next == null) {
          result.parseErrors.push(`${arg} requires a value`);
          break;
        }
        result.textInput = next;
        index += 1;
        break;
      case "-i":
      case "--input-file":
        if (next == null) {
          result.parseErrors.push(`${arg} requires a value`);
          break;
        }
        result.inputFile = next;
        index += 1;
        break;
      case "-l":
      case "--language":
        if (next == null) {
          result.parseErrors.push(`${arg} requires a value`);
          break;
        }
        result.language = next;
        index += 1;
        break;
      case "-n":
      case "--ngram-size":
        index += assignNumberArg(result, arg, next, "ngramSize");
        break;
      case "-df":
      case "--dedup-func":
        if (next == null) {
          result.parseErrors.push(`${arg} requires a value`);
          break;
        }
        result.dedupFunc = next;
        index += 1;
        break;
      case "-dl":
      case "--dedup-lim":
        index += assignNumberArg(result, arg, next, "dedupLim");
        break;
      case "-ws":
      case "--window-size":
        index += assignNumberArg(result, arg, next, "windowSize");
        break;
      case "-t":
      case "--top":
        index += assignNumberArg(result, arg, next, "top");
        break;
      case "-v":
      case "--verbose":
        result.verbose = true;
        break;
      case "--help":
        result.help = true;
        break;
    }
  }

  return result;
}

export function validateCliArgs(args: CliArgs): string[] {
  const errors = [...args.parseErrors];

  if (args.help) {
    return errors;
  }

  if (!args.textInput && !args.inputFile) {
    errors.push("either --text-input or --input-file is required");
  }

  if (args.ngramSize != null && (!Number.isInteger(args.ngramSize) || args.ngramSize <= 0)) {
    errors.push("--ngram-size must be a positive integer");
  }

  if (args.top != null && (!Number.isInteger(args.top) || args.top <= 0)) {
    errors.push("--top must be a positive integer");
  }

  if (args.windowSize != null && (!Number.isInteger(args.windowSize) || args.windowSize <= 0)) {
    errors.push("--window-size must be a positive integer");
  }

  if (args.dedupLim != null && (!Number.isFinite(args.dedupLim) || args.dedupLim < 0 || args.dedupLim > 1)) {
    errors.push("--dedup-lim must be between 0 and 1");
  }

  if (args.dedupFunc != null && !VALID_DEDUP_FUNCTIONS.has(args.dedupFunc.toLowerCase())) {
    errors.push("--dedup-func must be one of leve, levs, jaro, jaro_winkler, seqm, sequencematcher");
  }

  return errors;
}

export function formatCliOutput(keywords: KeywordScore[], verbose: boolean): string {
  if (verbose) {
    return `${JSON.stringify(keywords, null, 2)}\n`;
  }

  return `${keywords.map(([keyword]) => keyword).join("\n")}\n`;
}

export function helpText(): string {
  return "Usage: yaket [OPTIONS]\n\nOptions:\n  -ti, --text-input TEXT     Input text\n  -i, --input-file TEXT      Input file\n  -l, --language TEXT        Language\n  -n, --ngram-size INTEGER   Max size of the ngram\n  -df, --dedup-func TEXT     Deduplication function (leve|jaro|seqm)\n  -dl, --dedup-lim FLOAT     Deduplication limit\n  -ws, --window-size INT     Window size\n  -t, --top INTEGER          Number of keywords to extract\n  -v, --verbose              Print keyword-score pairs as JSON\n  --help                     Show this message\n";
}

export function runCli(argv: string[], deps: Partial<CliDeps> = {}): number {
  const runtime = buildDeps(deps);
  const args = parseCliArgs(argv);

  if (args.help) {
    runtime.stdout(helpText());
    return 0;
  }

  const validationErrors = validateCliArgs(args);
  if (validationErrors.length > 0) {
    runtime.stderr(`${validationErrors.join("\n")}\n`);
    runtime.stdout(helpText());
    return 1;
  }

  let text: string;
  try {
    text = args.textInput ?? runtime.readFile(args.inputFile!);
  } catch (error) {
    runtime.stderr(`failed to read input file: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }

  const keywords = runtime.extract(text, {
    lan: args.language,
    n: args.ngramSize,
    dedupFunc: args.dedupFunc,
    dedupLim: args.dedupLim,
    windowSize: args.windowSize,
    top: args.top,
  });

  runtime.stdout(formatCliOutput(keywords, args.verbose));
  return 0;
}

function assignNumberArg(args: CliArgs, flag: string, next: string | undefined, key: "ngramSize" | "dedupLim" | "windowSize" | "top"): number {
  if (next == null) {
    args.parseErrors.push(`${flag} requires a value`);
    return 0;
  }

  const value = Number(next);
  if (Number.isNaN(value)) {
    args.parseErrors.push(`${flag} must be numeric`);
    return 1;
  }

  args[key] = value;
  return 1;
}

function buildDeps(deps: Partial<CliDeps>): CliDeps {
  return {
    readFile: deps.readFile ?? ((path) => readFileSync(path, "utf8")),
    extract: deps.extract ?? extractKeywords,
    stdout: deps.stdout ?? ((message) => process.stdout.write(message)),
    stderr: deps.stderr ?? ((message) => process.stderr.write(message)),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(runCli(process.argv.slice(2)));
}
